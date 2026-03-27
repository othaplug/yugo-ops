(function () {
  "use strict";

  var WIDGET_URL = (document.currentScript && document.currentScript.src)
    ? new URL(document.currentScript.src).origin + "/widget/quote"
    : "https://helloyugo.com/widget/quote";

  function createIframe(container) {
    var iframe = document.createElement("iframe");
    iframe.src = WIDGET_URL;
    iframe.style.cssText =
      "width:100%;min-height:640px;border:none;border-radius:16px;display:block;";
    iframe.setAttribute("title", "Yugo+ Quote Widget");
    iframe.setAttribute("loading", "lazy");
    container.appendChild(iframe);

    window.addEventListener("message", function (e) {
      if (e.data && e.data.type === "yugo-widget-resize" && typeof e.data.height === "number") {
        iframe.style.height = e.data.height + "px";
      }
    });
  }

  var target = document.getElementById("yugo-quote-widget");
  if (target) {
    createIframe(target);
  }

  window.YugoQuoteWidget = {
    open: function () {
      var overlay = document.createElement("div");
      overlay.id = "yugo-widget-overlay";
      overlay.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;";
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
          overlay.remove();
        }
      });

      var wrapper = document.createElement("div");
      wrapper.style.cssText =
        "width:100%;max-width:960px;max-height:90vh;overflow-y:auto;border-radius:16px;background:#FAF7F2;position:relative;";

      var close = document.createElement("button");
      close.innerHTML = "&times;";
      close.style.cssText =
        "position:absolute;top:8px;right:12px;z-index:10;background:none;border:none;font-size:28px;color:#888;cursor:pointer;line-height:1;";
      close.addEventListener("click", function () {
        overlay.remove();
      });

      var iframe = document.createElement("iframe");
      iframe.src = WIDGET_URL;
      iframe.style.cssText = "width:100%;min-height:640px;border:none;";
      iframe.setAttribute("title", "Yugo+ Quote Widget");

      window.addEventListener("message", function (e) {
        if (e.data && e.data.type === "yugo-widget-resize" && typeof e.data.height === "number") {
          iframe.style.height = e.data.height + "px";
        }
      });

      wrapper.appendChild(close);
      wrapper.appendChild(iframe);
      overlay.appendChild(wrapper);
      document.body.appendChild(overlay);
    },
  };
})();
