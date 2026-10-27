// Translate display text; stored values, IDs, comparisons and user content stay intact.
module.exports=function({types:t}){
 const hasChinese=value=>typeof value==='string'&&/[\u3400-\u9fff]/.test(value)
 function call(value){const expression=t.logicalExpression('??',t.optionalCallExpression(t.optionalMemberExpression(t.optionalMemberExpression(t.memberExpression(t.identifier('window'),t.identifier('CRA1Shared')),t.identifier('I18n'),false,true),t.identifier('t'),false,true),[t.stringLiteral(value)],true),t.stringLiteral(value));expression._cra1Translated=true;return expression}
 const display=new Set(['title','label','placeholder','aria-label','alt','emptyText','loadingText','description'])
 return {visitor:{
  JSXText(p){const value=p.node.value.replace(/\s+/g,' ').trim();if(hasChinese(value))p.replaceWith(t.jsxExpressionContainer(call(value)))},
  JSXAttribute(p){if(display.has(p.node.name.name)&&t.isStringLiteral(p.node.value)&&hasChinese(p.node.value.value))p.node.value=t.jsxExpressionContainer(call(p.node.value.value))},
  ObjectProperty(p){const key=p.node.computed?'':(p.node.key.name||p.node.key.value);if(display.has(key)&&t.isStringLiteral(p.node.value)&&hasChinese(p.node.value.value))p.node.value=call(p.node.value.value)},
  JSXExpressionContainer(p){
   if(p.parentPath.isJSXAttribute()&&!display.has(p.parentPath.node.name.name))return
   function convert(node){if(node?._cra1Translated)return node;if(t.isStringLiteral(node)&&hasChinese(node.value))return call(node.value);if(t.isConditionalExpression(node)){node.consequent=convert(node.consequent);node.alternate=convert(node.alternate)}if(t.isLogicalExpression(node))node.right=convert(node.right);return node}
   p.node.expression=convert(p.node.expression)
  }
 }}
}
