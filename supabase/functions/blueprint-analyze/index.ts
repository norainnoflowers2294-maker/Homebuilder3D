// HomeCraft 3D: authenticated OpenRouter proxy for blueprint analysis.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const allowedModels = new Set(['deepseek/deepseek-v4.1-flash','z-ai/glm-5.3-flash','qwen/qwen3.8-flash']);
function reply(status: number, body: Record<string, unknown>) { return new Response(JSON.stringify(body), { status, headers: corsHeaders }); }
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply(405, { ok: false, error: 'Method not allowed.' });
  const authHeader=req.headers.get('Authorization')||'';
  if(!authHeader.startsWith('Bearer ')) return reply(401,{ok:false,error:'Please sign in to your HomeCraft account first.'});
  const supabaseUrl=Deno.env.get('SUPABASE_URL');
  let anonKey=Deno.env.get('SUPABASE_ANON_KEY')||'';
  if(!anonKey){try{anonKey=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||'';}catch(_){}}
  if(!supabaseUrl||!anonKey) return reply(500,{ok:false,error:'Supabase authentication is not configured for this function.'});
  try{
    const userCheck=await fetch(supabaseUrl+'/auth/v1/user',{headers:{apikey:anonKey,Authorization:authHeader}});
    if(!userCheck.ok) return reply(401,{ok:false,error:'Your HomeCraft session expired. Sign in again and retry.'});
  }catch(_){return reply(503,{ok:false,error:'Could not verify your HomeCraft sign-in. Check your connection.'});}
  const apiKey=Deno.env.get('OPENROUTER_API_KEY');
  if(!apiKey) return reply(503,{ok:false,error:'OpenRouter is not configured yet. Add OPENROUTER_API_KEY to Supabase → Edge Function Secrets.'});
  let body:any;
  try{const length=Number(req.headers.get('content-length')||0);if(length>7*1024*1024)return reply(413,{ok:false,error:'Blueprint upload is too large. Please use a smaller image.'});body=await req.json();}
  catch(_){return reply(400,{ok:false,error:'Invalid request body.'});}
  const model=allowedModels.has(body?.model)?body.model:'deepseek/deepseek-v4.1-flash';
  const action=body?.action||'analyze';
  const prompt=action==='test'?'Reply with exactly this text and nothing else: OPENROUTER_CONNECTED':String(body?.prompt||'');
  if(!prompt||prompt.length>24000)return reply(400,{ok:false,error:'The AI prompt is missing or too long.'});
  const content:any[]=[{type:'text',text:prompt}];
  if(action==='analyze'){
    const mime=String(body?.mimeType||'image/jpeg'),imageBase64=String(body?.imageBase64||'');
    if(!['image/jpeg','image/png','image/webp'].includes(mime))return reply(400,{ok:false,error:'Unsupported blueprint image format.'});
    if(!imageBase64||imageBase64.length>6*1024*1024||!/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64))return reply(400,{ok:false,error:'Blueprint image data is missing or too large. Please upload the image again.'});
    content.push({type:'image_url',image_url:{url:'data:'+mime+';base64,'+imageBase64}});
  }else if(action!=='text'&&action!=='test')return reply(400,{ok:false,error:'Unknown OpenRouter action.'});
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
  try{
    const upstream=await fetch('https://openrouter.ai/api/v1/chat/completions',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','HTTP-Referer':'https://norainnoflowers2294-maker.github.io/Homebuilder3D/','X-Title':'HomeCraft 3D'},
      body:JSON.stringify({model,messages:[{role:'user',content:action==='text'||action==='test'?prompt:content}],temperature:0.1,max_tokens:action==='test'?40:8000,stream:false}),
    });
    const result=await upstream.json().catch(()=>({}));
    if(!upstream.ok){const message=result?.error?.message||result?.message||('OpenRouter returned HTTP '+upstream.status+'.');return reply(502,{ok:false,error:String(message).slice(0,500),upstreamStatus:upstream.status});}
    const raw=result?.choices?.[0]?.message?.content;
    const text=Array.isArray(raw)?raw.map((part:any)=>part?.text||'').join('\n'):String(raw||'');
    if(!text.trim())return reply(502,{ok:false,error:'OpenRouter returned an empty response. Try another vision model.'});
    return reply(200,{ok:true,model,text,usage:result?.usage||null});
  }catch(err){const message=err?.name==='AbortError'?'OpenRouter took too long to respond. Please retry.':'Could not reach OpenRouter. Check your connection and retry.';return reply(502,{ok:false,error:message});}
  finally{clearTimeout(timeout);}
});
