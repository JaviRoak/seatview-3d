import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {layoutSchema} from '../src/lib/venue/schema';

describe('configuración Mágico González / Bocelli',()=>{
  it('conserva modelo, admisión y tipo de concierto al validar el JSON de la API',()=>{
    const {layout}=JSON.parse(readFileSync(resolve(__dirname,'../../frontend/public/models/magico-seating.json'),'utf8'));
    const parsed=layoutSchema.parse({...layout,concert:{kind:'bocelli',demo:true},admission:{mode:'mixed',crowdUrl:'/models/bocelli-crowd.json'}});
    expect(parsed.concert).toEqual({kind:'bocelli',demo:true});
    expect(parsed.model?.url).toBe('/models/magico-concert.glb');
    expect(parsed.admission?.crowdUrl).toBe('/models/bocelli-crowd.json');
  });
});
