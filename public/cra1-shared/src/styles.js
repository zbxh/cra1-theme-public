/* Legacy hosts keep their DOM, framework and business events. Class markers
 * let them use the same component declarations instead of copied CSS skins. */
(function (root) {
  var document=root.document;
  var definitions=__CRA1_LEGACY_CLASSES__;
  var theme=document.documentElement.getAttribute('data-cra1-theme');
  if(theme!=='website'&&theme!=='member'&&theme!=='cart')return;
  var entries=Object.entries(definitions[theme==='website'?'website':'system']);
  var business=root.CRA1Shared.BusinessIcons;
  var motion=root.CRA1Shared.Motion;
  var selector=entries.map(function(entry){return entry[1];}).join(',')+(business?','+business.selector:'');
  var owned=new WeakMap();
  function apply(element){
    if(!element||element.nodeType!==1)return;
    if(business)business.apply(element);
    var previous=owned.get(element);
    // Existing React/Alpine components already declare their semantic variants.
    if(!previous&&Array.from(element.classList).some(function(name){return /^cui-/.test(name);}))return;
    var next=new Set();
    entries.forEach(function(entry){if(element.matches(entry[1]))next.add(entry[0]);});
    if(!previous&&!next.size)return;
    if(previous)previous.tokens.forEach(function(name){if(!next.has(name)&&element.classList.contains(name))element.classList.remove(name);});
    next.forEach(function(name){if(!element.classList.contains(name))element.classList.add(name);});
    owned.set(element,{tokens:next,signature:element.getAttribute('class')});
  }
  function scan(node){
    if(!node||node.nodeType!==1&&node.nodeType!==9)return;
    if(node.nodeType===1)apply(node);
    node.querySelectorAll(selector).forEach(apply);
    if(motion)motion.scan(node);
  }
  var observer=new MutationObserver(function(records){
    var pending=new Set();
    records.forEach(function(record){
      if(record.type==='childList')record.addedNodes.forEach(function(node){if(node.nodeType===1)pending.add(node);});
      else if(record.type==='attributes'){
        var previous=owned.get(record.target);
        if(!previous||previous.signature!==record.target.getAttribute('class'))pending.add(record.target);
      }
    });
    pending.forEach(function(node){
      if(!node.isConnected)return;
      for(var parent=node.parentElement;parent;parent=parent.parentElement)if(pending.has(parent))return;
      scan(node);
    });
    if(motion)motion.update(records);
  });
  // Avoid repeatedly walking the parser's incomplete subtrees. Existing theme
  // markup already declares cui classes for above-the-fold content; the legacy
  // pass runs before deferred framework page modules and async plugin content.
  function start(){
    observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeOldValue:true,attributeFilter:['class','data-cra1-icon-label','data-cui-icon-style','title','aria-selected']});
    if(motion)motion.start();
    scan(document);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
  root.CRA1Shared.Styles={refresh:scan,disconnect:function(){observer.disconnect();if(motion)motion.destroy();}};
})(window);
