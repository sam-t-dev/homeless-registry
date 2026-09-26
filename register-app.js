(function(){
  function go(){
    var b64=window.__REGAPP_B1+window.__REGAPP_B2;
    var bin=Uint8Array.from(atob(b64),function(c){return c.charCodeAt(0);});
    var src=pako.inflate(bin,{to:'string'});
    var s=document.createElement('script'); s.text=src; document.body.appendChild(s);
  }
  if(window.pako) go(); else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js';
    s.onload=go; document.head.appendChild(s);
  }
})();
