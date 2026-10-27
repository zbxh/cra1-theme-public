import {test} from 'node:test'
import assert from 'node:assert/strict'
import {loginAccount, loginMethods, passwordError, providerLogo} from '../src/lib/auth-policy.js'
test('login groups native password channels while retaining only enabled methods',()=>{
  for(let mask=0;mask<8;mask++) {
    const methods=['email-password','phone-password','phone-code'].filter((_,i)=>mask&(1<<i))
    assert.deepEqual(loginMethods(methods),[...(mask&3?['password']:[]),...(mask&4?['phone-code']:[])])
  }
})
test('unified accounts detect email or phone and keep the complete original value',()=>{
  const methods=['email-password','phone-password','phone-code']
  for(const value of ['name+tag@example.com','123456789012345@example.com','first.last@sub.example.com','  Name@Example.COM  ']) {
    const result=loginAccount(value,{methods});assert.equal(result.type,'email');assert.equal(result.value,value.trim());assert.equal(result.error,'')
  }
  assert.deepEqual(loginAccount('13812345678',{methods}),{type:'phone',value:'13812345678',error:''})
  assert.equal(loginAccount('2025550100',{methods,phoneCode:'1'}).error,'')
  for(const value of ['1381234567','138123456782','138 12345678','abc','name@@example.com','name@example','name@example..com','.name@example.com','name.@example.com','first..last@example.com','name@-example.com'])assert.ok(loginAccount(value,{methods}).error,value)
})
test('inferred account channels cannot bypass disabled native policies',()=>{
  assert.ok(loginAccount('13812345678',{methods:['email-password']}).error)
  assert.ok(loginAccount('name@example.com',{methods:['phone-password']}).error)
  assert.ok(loginAccount('13812345678',{methods:['phone-password'],code:true}).error)
  assert.equal(loginAccount('13812345678',{methods:['phone-code'],code:true}).error,'')
  assert.ok(loginAccount('name@example.com',{methods:['phone-code'],code:true}).error)
  assert.ok(loginAccount('',{methods:['phone-password']}).error)
})
test('login preserves existing passwords even when new-password rules change',()=>{
  for(const password of ['a','weak','a'.repeat(40)])assert.equal(passwordError(password,{login:true,strong:true}),'')
  assert.ok(passwordError('',{login:true}))
})
test('native creation limits and each strong-password condition',()=>{
  for(const password of ['12345','a'.repeat(33)])assert.ok(passwordError(password))
  assert.equal(passwordError('abcdef'),'')
  for(const password of ['Ab!78xy','abcdefgh9!','AbdcEfgh!','AbdcEfgh9','AbCd9!aaa','AbCd9!cba','AbCd9!123'])assert.ok(passwordError(password,{strong:true}),password)
  for(const password of ['Az!7mx2Q','Az7mx2Q]','Az7mx2Q\\','Az7mx2Q`'])assert.equal(passwordError(password,{strong:true}),'',password)
})
test('provider logos are dynamic, with native img and legacy logo fallback',()=>{
  assert.equal(providerLogo({img:'/icons/new.svg'},'https://example.com'),'https://example.com/icons/new.svg')
  assert.equal(providerLogo({logo:'https://cdn.example.com/icon.png'},'https://example.com'),'https://cdn.example.com/icon.png')
  for(const img of ['javascript:alert(1)','data:text/html,test','https://secret@host.example/icon'])assert.equal(providerLogo({img},'https://example.com'),'')
})
