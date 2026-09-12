import { describe, expect, it } from 'vitest'
import { countryBiasCode, mapGeoapifySuggestions, normalizePlaceQuery } from './place-autocomplete'

describe('place autocomplete',()=>{
  it('normalizes user input without changing its words',()=>{
    expect(normalizePlaceQuery('  Colón   100   Goya ')).toBe('Colón 100 Goya')
  })

  it('derives a non-restrictive country bias when the country is known',()=>{
    expect(countryBiasCode('Argentina')).toBe('ar')
    expect(countryBiasCode('México')).toBe('mx')
    expect(countryBiasCode('Argentina + Uruguay')).toBeUndefined()
  })

  it('keeps exact house numbers and removes duplicate suggestions',()=>{
    const result={place_id:'one',name:'Colón 100',street:'Colón',housenumber:'100',city:'Municipio de Goya',state:'Corrientes',country:'Argentina',rank:{match_type:'full_match',confidence_building_level:1}}
    const suggestions=mapGeoapifySuggestions([result,{...result,place_id:'two'}],'Colon 100 Goya')
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({name:'Colón 100',address:'Goya, Corrientes, Argentina',approximate:false,hasHouseNumber:true})
  })

  it('marks low-confidence street approximations without claiming an exact number',()=>{
    const [suggestion]=mapGeoapifySuggestions([{
      name:'Colón 1734',street:'Colón',city:'Goya',state:'Corrientes',country:'Argentina',
      rank:{match_type:'match_by_street',confidence_building_level:0.4},
    }],'Colon 1734 Goya')
    expect(suggestion).toMatchObject({approximate:true,hasHouseNumber:false})
  })
})
