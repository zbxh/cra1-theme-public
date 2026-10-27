(function(root){
 var shared=root.CRA1Shared=root.CRA1Shared||{},dictionary=__CRA1_TRANSLATIONS__;
 shared.I18n={t:function(text){if(typeof text!=='string')return text;var lang;try{lang=root.localStorage.getItem('lang')}catch(e){}lang=lang||root.__CRA1_RUNTIME__?.locale?.current||'zh-cn';return dictionary[text]?.[lang]||text;}};
})(window);
