(function(){
  function go(){
    var b=Uint8Array.from(atob(window.__C1+window.__C2),function(c){return c.charCodeAt(0);});
    window.CITIES_BY_COUNTRY=JSON.parse(pako.inflate(b,{to:'string'}));
    document.dispatchEvent(new Event('cities-ready'));
  }
  if(window.pako) go(); else {
    var s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako.min.js';
    s.onload=go; document.head.appendChild(s);
  }
})();
