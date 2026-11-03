// Secure OpenRouter client for HomeCraft 3D blueprint analysis.
import { getClient, isBackendConfigured } from '../supabase/client.js';
export const DEFAULT_BLUEPRINT_MODEL = 'deepseek/deepseek-v4.1-flash';
export let OPENROUTER_MODELS = [{ id: DEFAULT_BLUEPRINT_MODEL, label: 'DeepSeek V4.1 Flash · Default' }];
export async function fetchOpenRouterModels(){
  const data=await invoke({action:'models'});
  OPENROUTER_MODELS=(data.models||[]).map(m=>({id:m.id,label:m.name||m.id,context:m.context_length||0}));
  return OPENROUTER_MODELS;
}
const MODEL_KEY = 'hc.openrouter.model';
export function getBlueprintModel(){ try { return localStorage.getItem(MODEL_KEY) || DEFAULT_BLUEPRINT_MODEL; } catch(e){ return DEFAULT_BLUEPRINT_MODEL; } }
export function setBlueprintModel(model){
  const value=typeof model==='string'&&/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._:-]+$/.test(model)?model:DEFAULT_BLUEPRINT_MODEL;
  try { localStorage.setItem(MODEL_KEY,value); } catch(e) {}
  return value;
}
async function invoke(payload){
  if(!isBackendConfigured()) throw new Error('Connect Supabase first in Settings → Backend. OpenRouter runs securely through your Supabase backend.');
  const sb=await getClient();
  const {data,error}=await sb.functions.invoke('blueprint-analyze',{body:payload});
  if(error){
    let message=error.message||'OpenRouter request failed.';
    try { const detail=await error.context?.json(); if(detail?.error) message=detail.error; else if(detail?.message) message=detail.message; } catch(e) {}
    throw new Error(message);
  }
  if(!data||data.ok!==true) throw new Error(data?.error||'The AI service returned an invalid response.');
  return data;
}
function blobBase64(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{const value=String(reader.result||''),comma=value.indexOf(',');if(comma<0)return reject(new Error('Could not prepare the blueprint image.'));resolve(value.slice(comma+1));};
    reader.onerror=()=>reject(new Error('Could not read the blueprint image.'));
    reader.readAsDataURL(blob);
  });
}
export async function analyzeBlueprintImage(blob,prompt,model=getBlueprintModel()){
  if(!(blob instanceof Blob)) throw new Error('Blueprint image is missing. Please upload it again.');
  if(blob.size>5*1024*1024) throw new Error('Blueprint image is too large. Please use a smaller image or PDF page.');
  const imageBase64=await blobBase64(blob);
  return invoke({action:'analyze',model:setBlueprintModel(model),prompt,imageBase64,mimeType:blob.type||'image/jpeg'});
}
export async function generateBlueprintText(prompt,model=getBlueprintModel()){return invoke({action:'text',model:setBlueprintModel(model),prompt});}
export async function testOpenRouterConnection(model=getBlueprintModel()){return invoke({action:'test',model:setBlueprintModel(model)});}

export const getOpenRouterModel=getBlueprintModel;
export const setOpenRouterModel=setBlueprintModel;
export async function generateOpenRouterText(prompt,model=getBlueprintModel()){const r=await invoke({action:'text',model:setBlueprintModel(model),prompt});return r.text;}
