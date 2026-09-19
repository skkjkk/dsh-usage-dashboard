window.__ModuleLoader__.load({
  id: "@skkjkk/dsh-usage-dashboard",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    const React = require("react");
    // host 桥垫片：host.call(method, args) → GET /dash-api/<method>?<query>
    const host = {
      call: (method, args) => {
        const q = new URLSearchParams();
        for (const [k, v] of Object.entries(args || {})) {
          if (v === null || v === undefined || v === "") continue;
          if (Array.isArray(v)) { if (v.length) q.set(k, v.join(",")); }
          else q.set(k, String(v));
        }
        const qs = q.toString();
        return fetch("/dash-api/" + method + (qs ? "?" + qs : "")).then((r) => r.json());
      }
    };
const CSS = '.dd-bar-inner{position:relative;}.dd-seg-overlay{position:absolute;left:0;right:0;bottom:0;}.dd-root{min-height:100%;}.dd-dash{background:#f3f4f6;min-height:100%;padding:16px;box-sizing:border-box;font-family:"Century Gothic","Microsoft YaHei UI","PingFang SC","Microsoft YaHei",sans-serif;color:#09090b;}.dd-dash button{font-family:inherit;}.dd-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;}.dd-range{display:flex;align-items:center;border-radius:999px;background:#e2e3e7;padding:2px;gap:1px;flex-wrap:wrap;}.dd-pill{display:flex;align-items:center;height:24px;border-radius:999px;padding:0 9px;font-size:12px;border:none;cursor:pointer;background:transparent;color:#52525b;transition:background .12s ease,color .12s ease;}.dd-pill:hover{color:#09090b;}.dd-pill.on{background:#18181b;color:#fff;font-weight:600;}.dd-custom{display:flex;align-items:center;gap:8px;border-radius:6px;border:1px solid #d4d4d8;background:#fff;padding:6px 10px;flex-wrap:wrap;}.dd-custom input{background:#fff;border:1px solid #d4d4d8;border-radius:4px;color:#18181b;font-size:12px;padding:2px 6px;font-family:inherit;color-scheme:light;}.dd-custom input:focus{border-color:#18181b;outline:none;}.dd-custom .sep{font-size:12px;color:#a1a1aa;}.dd-custom .apply{display:flex;align-items:center;height:24px;border-radius:999px;background:#18181b;color:#fff;padding:0 10px;font-size:12px;font-weight:600;border:none;cursor:pointer;}.dd-custom .apply:hover{background:#27272a;}.dd-spacer{flex:1;}.dd-filter-row{display:flex;align-items:center;gap:8px;min-height:28px;flex-wrap:wrap;}.dd-drop{position:relative;}.dd-drop-btn{display:flex;align-items:center;gap:6px;min-height:28px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;padding:0 9px;font-size:12px;cursor:pointer;font-family:inherit;color:#52525b;transition:background .12s ease,border-color .12s ease,color .12s ease;}.dd-drop-btn:hover{color:#18181b;border-color:#a1a1aa;}.dd-drop-btn.open{color:#09090b;border-color:#18181b;}.dd-drop-icon{display:inline-flex;color:#71717a;flex:none;}.dd-drop-btn.open .dd-drop-icon{color:#09090b;}.dd-drop-label{font-weight:500;flex:none;color:inherit;}.dd-drop-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1a1aa;}.dd-drop-btn.open .dd-drop-value{color:#52525b;}.dd-drop-arrow{display:inline-flex;color:#a1a1aa;flex:none;transition:transform .15s ease;}.dd-drop-btn.open .dd-drop-arrow{transform:rotate(180deg);}.dd-drop-menu{position:absolute;top:34px;left:0;z-index:50;min-width:220px;max-height:260px;overflow-y:auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,.08);padding:4px 0;scrollbar-width:none;}.dd-drop-menu::-webkit-scrollbar{display:none;}.dd-drop-item{display:flex;align-items:center;gap:7px;width:100%;text-align:left;border:none;background:none;height:28px;padding:0 10px;font-size:12px;color:#52525b;cursor:pointer;font-family:inherit;white-space:nowrap;}.dd-drop-item:hover{background:#f3f4f6;color:#18181b;}.dd-drop-item.on{background:#f3f4f6;color:#18181b;}.dd-check{display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;flex:none;background:transparent;border:1px solid #d4d4d8;color:#18181b;}.dd-drop-item.on .dd-check{background:#18181b;border:none;color:#fff;}.dd-drop-item .label{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.dd-drop-item .sub{color:#a1a1aa;font-size:11px;flex:none;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;}.dd-clear{background:none;border:none;color:#dc2626;font-size:12px;font-weight:500;cursor:pointer;padding:0 6px;height:28px;}.dd-clear:hover{text-decoration:underline;}.dd-busy{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#52525b;}.dd-busy .spinner{width:12px;height:12px;border:1.5px solid #e2e3e7;border-top-color:#18181b;border-radius:50%;animation:ddspin .7s linear infinite;}.dd-rows{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;}@media (min-width:768px){.dd-rows{grid-template-columns:repeat(5,1fr);gap:12px;}}.dd-kpi{min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:20px;text-align:left;position:relative;overflow:hidden;transition:border-color .12s ease,background .12s ease;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-kpi.clickable{cursor:pointer;}.dd-kpi.clickable:hover{border-color:#d4d4d8;}.dd-kpi.clickable:active{background:#fafafa;}.dd-kpi-label{display:flex;align-items:center;justify-content:space-between;font-size:13px;line-height:1.3;color:#52525b;margin-bottom:4px;min-height:19px;}.dd-kpi-label .lt{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;white-space:nowrap;flex:1 1 auto;}.dd-kpi-label .pct{font-size:11px;white-space:nowrap;flex:none;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;margin-left:4px;}.dd-pct-up{color:#71717a;}.dd-pct-down{color:#a1a1aa;}.dd-pct-flat{color:#a1a1aa;}.dd-info-wrap{position:relative;display:inline-flex;flex:none;}.dd-info{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:999px;border:1px solid #d4d4d8;color:#52525b;cursor:pointer;flex:none;background:#fff;padding:0;transition:border-color .12s ease,color .12s ease;}.dd-info:hover{border-color:#a1a1aa;color:#18181b;}.dd-info svg{display:block;}.dd-kpi-value{margin-top:0;height:30px;overflow:hidden;white-space:nowrap;font-size:24px;font-weight:700;line-height:30px;font-variant-numeric:tabular-nums;color:#09090b;}.dd-v-cost{color:#34d399;}.dd-v-dur{color:#60a5fa;}.dd-v-cache{color:#71717a;}.dd-pop{position:fixed;z-index:200;background:#fff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 20px 25px -5px rgba(0,0,0,.15);padding:14px 16px;box-sizing:border-box;max-width:calc(100vw - 16px);white-space:normal;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-pop .pop-title{font-size:13px;font-weight:700;color:#09090b;margin-bottom:8px;}.dd-pop .pop-body{font-size:12px;line-height:1.7;color:#52525b;overflow-wrap:break-word;word-break:break-word;}.dd-pop .pop-sec{margin-top:10px;}.dd-pop .pop-sec .sec-title{font-size:12px;font-weight:700;color:#09090b;margin-bottom:4px;}.dd-pop table{border-collapse:collapse;width:100%;margin-top:8px;table-layout:fixed;}.dd-pop th{font-size:10px;color:#a1a1aa;font-weight:500;text-align:left;padding:2px 6px 4px 0;border-bottom:1px solid #e4e4e7;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;overflow-wrap:break-word;word-break:break-all;}.dd-pop td{font-size:11px;color:#52525b;padding:4px 6px 4px 0;border-bottom:1px solid #f3f4f6;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;white-space:normal;overflow-wrap:break-word;word-break:break-all;}.dd-pop td.mdl{overflow:hidden;text-overflow:ellipsis;}.dd-pop td.unmatched{color:#a1a1aa;}.dd-charts{display:flex;flex-direction:column;gap:24px;}.dd-chart{min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-chart-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:24px;}.dd-chart-title{display:flex;align-items:center;gap:6px;min-width:0;font-size:15px;font-weight:500;color:#52525b;white-space:nowrap;overflow:hidden;}.dd-chart-title .icon{display:inline-flex;color:#71717a;flex:none;}.dd-chart-tools{display:flex;align-items:center;gap:12px;flex:none;flex-wrap:wrap;}.dd-legend{display:flex;align-items:center;gap:12px;font-size:14px;color:#71717a;}.dd-legend-btn{display:flex;align-items:center;gap:6px;border:none;background:none;padding:0;cursor:pointer;font-size:14px;color:inherit;font-family:inherit;transition:opacity .12s ease;}.dd-legend-btn.off{opacity:.3;}.dd-swatch{display:inline-block;width:13px;height:13px;border-radius:4px;flex:none;}.dd-seg-group{display:inline-flex;align-items:center;gap:2px;border-radius:999px;background:#e2e3e7;padding:4px;}.dd-seg-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:3px 14px;border-radius:999px;font-size:14px;border:none;cursor:pointer;background:transparent;color:#52525b;transition:background .12s ease,color .12s ease;white-space:nowrap;}.dd-seg-btn:hover{color:#09090b;}.dd-seg-btn.on{background:#18181b;color:#fff;}.dd-plot-row{display:flex;width:100%;}.dd-y{display:flex;flex-direction:column;justify-content:space-between;width:58px;flex:0 0 58px;box-sizing:border-box;padding-right:8px;text-align:right;font-size:12px;white-space:nowrap;overflow:visible;color:#a1a1aa;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-y span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.dd-plot{position:relative;display:flex;align-items:flex-end;flex:1;min-width:0;height:220px;gap:1px;}.dd-col{position:relative;display:flex;flex-direction:column;justify-content:flex-end;flex:1 1 0;min-width:0;height:100%;cursor:pointer;}.dd-col.dim .dd-seg{opacity:.35;}.dd-bar-inner{width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;}.dd-seg{width:100%;transition:height .3s ease,opacity .3s ease,background-color .3s ease;}.dd-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:40;display:none;flex-direction:column;gap:3px;white-space:nowrap;border-radius:4px;background:#e2e3e7;border:1px solid #d4d4d8;box-shadow:0 20px 25px -5px rgba(0,0,0,.12);padding:8px 10px;font-size:14px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-col:hover .dd-tip{display:flex;}.dd-tip .tt-title{font-weight:700;margin-bottom:2px;color:#52525b;}.dd-tip .tt-row{color:#71717a;}.dd-tip .tt-cost{color:#34d399;}.dd-tip .tt-dur{color:#60a5fa;}.dd-tip .tt-dur2{color:#93c5fd;}.dd-x{display:flex;margin-left:58px;margin-top:8px;}.dd-x .labels{display:flex;flex:1;min-width:0;height:20px;position:relative;}.dd-x .labels .cell{flex:1;min-width:0;text-align:center;}.dd-x .labels .cell.abs{position:absolute;top:0;text-align:center;}.dd-x .labels .cell.abs span{transform:translateX(-50%);}.dd-x .labels span{display:inline-block;white-space:nowrap;font-size:14px;color:#71717a;}.dd-heat{display:flex;flex-direction:column;gap:12px;}.dd-heat-row{display:flex;align-items:center;gap:8px;}.dd-heat-day{width:40px;flex:none;font-size:13px;color:#71717a;text-align:left;}.dd-heat-cells{display:flex;flex:1;gap:6px;min-width:0;}.dd-heat-cell{position:relative;flex:1;aspect-ratio:1;min-width:0;}.dd-heat-cell .inner{width:100%;height:100%;border-radius:4px;transition:background-color .5s ease-out;}.dd-heat-cell .tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:40;display:none;flex-direction:column;gap:3px;white-space:normal;max-width:calc(100vw - 24px);box-sizing:border-box;border-radius:4px;background:#e2e3e7;border:1px solid #d4d4d8;box-shadow:0 20px 25px -5px rgba(0,0,0,.12);padding:8px 10px;font-size:14px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-heat-cell:hover .tip{display:flex;}.dd-heat-cell.edge-left .tip{left:0;transform:none;}.dd-heat-cell.edge-right .tip{left:100%;transform:translateX(-100%);}.dd-heat-cell .tip .tt-title{font-weight:700;margin-bottom:2px;color:#52525b;}.dd-heat-cell .tip .tt-token{color:#71717a;}.dd-heat-cell .tip .tt-cost{color:#34d399;}.dd-heat-cell .tip .tt-dur{color:#60a5fa;}.dd-heat-x{display:flex;margin-left:48px;margin-top:12px;}.dd-heat-x .labels{display:flex;flex:1;min-width:0;}.dd-heat-x .labels .cell{flex:1;text-align:center;}.dd-heat-x .labels span{font-size:14px;color:#71717a;}.dd-heat-legend{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:16px;}.dd-heat-legend .lbl{font-size:13px;color:#a1a1aa;line-height:1;}.dd-heat-legend .dots{display:flex;align-items:center;gap:4px;}.dd-dot{width:12px;height:12px;border-radius:4px;}.dd-cal{display:flex;flex-direction:column;gap:12px;width:100%;overflow:visible;}.dd-cal-body{display:flex;gap:8px;align-items:flex-start;overflow:visible;}.dd-cal-days{display:none;}.dd-cal-days span{font-size:10px;color:#a1a1aa;line-height:1;flex:1;display:flex;align-items:center;}.dd-cal-cols{display:grid;grid-template-columns:repeat(40,minmax(0,1fr));gap:6px;flex:1;min-width:0;align-items:start;}.dd-cal-col{display:flex;flex-direction:column;gap:6px;min-width:0;align-self:start;}.dd-cal-cell{position:relative;flex:0 0 auto;width:100%;aspect-ratio:1 / 1;min-width:0;border-radius:5px;}.dd-cal-floating-tip{position:fixed;z-index:1000;display:flex;flex-direction:column;gap:3px;transform:translate(-50%,-100%);pointer-events:none;white-space:normal;max-width:calc(100vw - 24px);box-sizing:border-box;border-radius:4px;background:#e2e3e7;border:1px solid #d4d4d8;box-shadow:0 20px 25px -5px rgba(0,0,0,.12);padding:6px 9px;font-size:12px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-cal-floating-tip.below{transform:translate(-50%,0);}.dd-cal-floating-tip .tt-token{color:#71717a;}.dd-cal-legend{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:10px;}.dd-cal-legend .lbl{font-size:11px;color:#a1a1aa;line-height:1;}.dd-cal-legend .dots{display:flex;gap:3px;}.dd-cal-dot{width:11px;height:11px;border-radius:3px;}.dd-records{margin-top:16px;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-records-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px;}.dd-records-title{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:500;color:#52525b;white-space:nowrap;overflow:hidden;}.dd-records-title .icon{display:inline-flex;color:#71717a;flex:none;}.dd-records-count{font-size:12px;color:#a1a1aa;flex:none;}.dd-records-scroll{overflow-x:auto;max-height:420px;overflow-y:auto;border-bottom:1px solid #f3f4f6;}.dd-records table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:820px;}.dd-records th{font-size:11px;color:#a1a1aa;font-weight:500;text-align:left;padding:6px 10px;border-bottom:1px solid #e4e4e7;white-space:nowrap;}.dd-records th.num{text-align:right;}.dd-records td{font-size:12px;color:#52525b;padding:6px 10px;border-bottom:1px solid #f3f4f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;}.dd-records td.num{text-align:right;}.dd-records td .sess{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-records tbody tr:hover td{background:#fafafa;}.dd-records .more{display:flex;align-items:center;justify-content:center;margin-top:12px;}.dd-records .more button{display:flex;align-items:center;height:28px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;padding:0 14px;font-size:12px;color:#52525b;cursor:pointer;font-family:inherit;transition:color .12s ease,border-color .12s ease;}.dd-records .more button:hover{color:#18181b;border-color:#a1a1aa;}.dd-records .more button:disabled{opacity:.5;cursor:default;}.dd-records .empty{padding:32px 0;text-align:center;color:#a1a1aa;font-size:13px;}.dd-dist-row{display:flex;flex-direction:column;gap:24px;margin-top:24px;margin-bottom:24px;}.dd-side-row{display:flex;flex-direction:row;gap:24px;margin-top:24px;margin-bottom:24px;}.dd-radar{flex:1 1 calc(50% - 12px);min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:20px 24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-radar-body{display:flex;align-items:center;gap:16px;}.dd-radar-donut{position:relative;flex:none;width:280px;height:280px;}.dd-radar-donut svg{display:block;}.dd-radar-legend{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}.dd-side-row .dd-chart{flex:1 1 calc(50% - 12px);min-width:0;}.dd-dist{flex:none;min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:20px 24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-dist-body{display:flex;align-items:center;gap:24px;}.dd-dist-donut{position:relative;flex:none;width:120px;height:120px;}.dd-dist-donut svg{display:block;}.dd-dist-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}.dd-dist-center .v{font-size:15px;font-weight:700;color:#18181b;white-space:nowrap;font-variant-numeric:tabular-nums;}.dd-dist-center .l{font-size:10px;color:#a1a1aa;}.dd-dist-legend{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}.dd-dist-item{display:flex;align-items:center;gap:8px;min-width:0;}.dd-dist-item .dot{width:10px;height:10px;border-radius:50%;flex:none;align-self:center;position:relative;top:-1px;}.dd-dist-item .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#52525b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-dist-item .val{font-size:12px;color:#18181b;flex:none;font-variant-numeric:tabular-nums;}.dd-dist-item .pct{font-size:14px;line-height:20px;color:#a1a1aa;flex:none;width:56px;text-align:right;font-variant-numeric:tabular-nums;position:relative;top:-1px;}.dd-cache-tip{position:absolute;z-index:50;display:flex;flex-direction:column;align-items:flex-start;gap:2px;border:1px solid #d4d4d8;border-radius:6px;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.1);padding:7px 10px;pointer-events:none;}.dd-cache-tip-line{font-size:11px;color:#52525b;font-weight:500;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace;white-space:nowrap;}.dd-cache-tip-rate{font-size:14px;color:#18181b;white-space:nowrap;}.dd-cache-tip-pct{font-weight:700;color:#10b981;font-variant-numeric:tabular-nums;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Consolas,monospace;}.ddc-layer{opacity:0;transition:opacity .26s ease;}.ddc-layer.on{opacity:1;}@keyframes ddcDraw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}.ddc-layer.on .ddc-line{animation:ddcDraw .6s cubic-bezier(.4,0,.2,1) both;}@keyframes ddcFade{from{opacity:0}to{opacity:1}}.ddc-layer.on .ddc-area{animation:ddcFade .5s ease .12s both;}.ddc-layer.on .ddc-cov{animation:ddcFade .55s ease .3s both;}@keyframes ddcRise{from{transform:scaleY(0)}to{transform:scaleY(1)}}.ddc-layer.on .ddc-bar{transform-box:fill-box;transform-origin:50% 100%;animation:ddcRise .5s cubic-bezier(.22,1,.36,1) both;animation-delay:calc(var(--i,0) * 26ms);}@keyframes ddcIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}.ddc-in{animation:ddcIn .35s ease both;}.dd-cache-empty{padding:40px 0;text-align:center;color:#a1a1aa;font-size:12px;}.dd-cache-kpis{display:flex;gap:8px;margin-bottom:10px;}.dd-cache-kpi{flex:1;border:1px solid #ececf0;border-radius:8px;padding:6px 11px;background:#fafafa;min-width:0;box-sizing:border-box;}.dd-cache-kpi .lab{font-size:10px;color:#a1a1aa;letter-spacing:.4px;white-space:nowrap;}.dd-cache-kpi .val{font-size:18px;font-weight:700;color:#18181b;margin-top:1px;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.dd-cache-kpi .val small{font-size:11px;color:#71717a;font-weight:500;}.dd-cache-kpi .delta{font-size:10px;font-weight:700;margin-left:5px;}.dd-cache-kpi .delta.up{color:#10b981;}.dd-cache-kpi .delta.down{color:#ef4444;}.dd-cache-kpi.hero{background:linear-gradient(135deg,#ecfdf5,#f6fefb 60%);border-color:#d1fae5;}.dd-cache-kpi.hero .val{color:#047857;}.dd-cache-legend{display:flex;gap:14px;font-size:10px;color:#71717a;margin:0 0 2px;flex-wrap:wrap;align-items:center;}.dd-cache-legend .lg{display:flex;align-items:center;gap:5px;}.dd-cache-legend .sw{width:14px;height:0;border-top:2px solid #999;display:inline-block;}.dd-cache-legend .sw.blk{height:8px;border:none;border-radius:2px;}.dd-cache-zoom{border:none;background:transparent;font-size:11px;color:#71717a;cursor:pointer;padding:2px 6px;font-family:inherit;border-radius:6px;white-space:nowrap;}.dd-cache-zoom:hover{color:#09090b;background:#f4f4f5;}.dd-cache-models{border-top:1px solid #f0f0f2;margin-top:8px;padding-top:4px;}.dd-cache-mtitle{display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#a1a1aa;letter-spacing:.4px;padding:2px 0;}.dd-cache-mbody{max-height:150px;overflow-y:auto;overflow-x:hidden;}.dd-cache-mrow{display:flex;align-items:center;gap:8px;padding:2px 4px;border-radius:6px;cursor:pointer;}.dd-cache-mrow:hover{background:#fafafa;}.dd-cache-mrow.sel{background:#f0fdf4;}.dd-cache-mrow .dot{width:7px;height:7px;border-radius:99px;flex:none;}.dd-cache-mrow .mname{font-size:11px;color:#3f3f46;width:112px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:none;}.dd-cache-mrow .mtrack{flex:1;height:12px;position:relative;background:#f6f6f8;border-radius:3px;min-width:0;}.dd-cache-mrow .mfill{position:absolute;left:0;top:0;bottom:0;border-radius:3px;opacity:.85;}.dd-cache-mrow .mcov{position:absolute;top:2px;bottom:2px;width:2px;background:#f59e0b;border-radius:2px;}.dd-cache-mrow .mval{font-size:11px;font-weight:700;color:#18181b;width:46px;text-align:right;flex:none;font-variant-numeric:tabular-nums;}.dd-cache-mrow .msave{font-size:10px;color:#059669;width:72px;text-align:right;flex:none;font-variant-numeric:tabular-nums;white-space:nowrap;}.dd-empty{padding:64px 0;text-align:center;color:#71717a;font-size:14px;}.dd-loading{padding:64px 0;text-align:center;color:#71717a;font-size:14px;animation:ddpulse 2s cubic-bezier(.4,0,.6,1) infinite;}@keyframes ddpulse{50%{opacity:.5;}}@keyframes ddspin{to{transform:rotate(360deg);}}[role="dialog"]:has([data-slot="settings.header"]){width:1320px!important;max-width:calc(100vw - 32px)!important;}[role="dialog"] nav > div:nth-of-type(2) > button:nth-child(5) > svg{display:none;}[role="dialog"] nav > div:nth-of-type(2) > button:nth-child(5)::before{content:"";display:block;width:16px;height:16px;flex:none;background-image:linear-gradient(#71717a,#71717a),linear-gradient(#71717a,#71717a),linear-gradient(#71717a,#71717a);background-size:3px 7px,3px 11px,3px 9px;background-position:2px 9px,6.5px 5px,11px 7px;background-repeat:no-repeat;}.dd-title{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:#09090b;margin-bottom:14px;}.dd-title .icon{display:inline-flex;color:#3f3f46;}.dd-dist-item{padding:4px 8px;min-height:30px;box-sizing:border-box;border-radius:6px;transition:opacity .15s ease;}.dd-dist-item.dim{opacity:.22;}.dd-dist-item .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;line-height:20px;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;position:relative;top:-1px;}.dd-dist-item .val{font-size:14px;font-weight:600;line-height:20px;color:#18181b;flex:none;font-variant-numeric:tabular-nums;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;position:relative;top:-1px;}.dd-dist-item .pct{font-size:14px;line-height:20px;color:#a1a1aa;flex:none;width:56px;text-align:right;font-variant-numeric:tabular-nums;position:relative;top:-1px;}.dd-dist-center .v{font-size:18px;font-weight:700;color:#18181b;white-space:nowrap;font-variant-numeric:tabular-nums;}.dd-records{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-records table td,.dd-records table th{font-variant-numeric:tabular-nums;}.dd-records-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px;}.dd-records-foot .info{font-size:12px;color:#71717a;font-variant-numeric:tabular-nums;}.dd-records-foot .pg{display:inline-flex;align-items:center;gap:6px;}.dd-records-foot .pg button{display:inline-flex;align-items:center;height:24px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;color:#18181b;font-size:12px;padding:0 10px;cursor:pointer;font-family:inherit;}.dd-records-foot .pg button:disabled{opacity:.4;cursor:default;}.dd-records-foot .pg .cur{font-size:12px;color:#52525b;font-variant-numeric:tabular-nums;}.dd-sec-head{margin-bottom:16px;}.dd-sec-heading{font-size:20px;font-weight:700;color:#09090b;margin:0 0 4px;line-height:1.3;}.dd-sec-intro{margin:0;font-size:13px;color:#71717a;line-height:1.5;}.dd-anim.on{animation:ddFade .35s ease;}@keyframes ddFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.dd-drop-count{color:#71717a;font-size:12px;font-variant-numeric:tabular-nums;}.dd-model-menu{position:absolute;right:0;top:calc(100% + 4px);width:300px;max-height:min(420px,70vh);display:flex;flex-direction:column;background:#fff;border:1px solid #e4e4e7;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);z-index:50;overflow:hidden;}.dd-model-actions{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #f0f0f2;flex:none;}.dd-model-actions .link{background:none;border:none;color:#18181b;font-size:12px;cursor:pointer;padding:2px 6px;font-family:inherit;border-radius:6px;}.dd-model-actions .link:hover{background:#f4f4f5;}.dd-model-actions .spacer{flex:1;}.dd-model-actions .cnt{font-size:12px;color:#a1a1aa;font-variant-numeric:tabular-nums;}.dd-model-scroll{overflow-y:auto;padding:4px 6px 8px;}.dd-series{margin-top:2px;}.dd-series-head{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;padding:6px;cursor:pointer;border-radius:6px;font-family:inherit;text-align:left;}.dd-series-head:hover{background:#f4f4f5;}.dd-series-head .chev{display:inline-flex;transition:transform .15s ease;color:#71717a;flex:none;}.dd-series-head .chev.open{transform:rotate(180deg);}.dd-series-head .name{flex:1;font-size:13px;font-weight:600;color:#18181b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.dd-series-head .cnt{font-size:12px;color:#a1a1aa;font-variant-numeric:tabular-nums;}.dd-series-body{display:flex;flex-direction:column;gap:2px;padding:2px 0 4px 18px;}.dd-model-item{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:12px;color:#52525b;min-width:0;}.dd-model-item:hover{background:#f4f4f5;}.dd-model-item .lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.dd-model-item input{accent-color:#18181b;margin:0;flex:none;'

module.exports = {
  inject: ['slots', 'timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return
    ctx.effect(() => {
        const tagId = "@skkjkk/dsh-usage-dashboard/dashboard.module.css";
        if (typeof document !== 'undefined') {
          const old = document.querySelectorAll('style[data-plugin-css=' + JSON.stringify(tagId) + ']');
          for (var _i = 0; _i < old.length; _i++) old[_i].remove();
          const tag = document.createElement('style');
          tag.dataset.plugin = "@skkjkk/dsh-usage-dashboard";
          tag.dataset.pluginCss = tagId;
          tag.textContent = CSS;
          document.head.appendChild(tag);
          return () => { tag.remove() };
        }
      })
    ctx.effect(() => installDashboardNavIcon(), 'usage-dashboard: settings icon')
    const h = React.createElement
    const BJ_OFFSET = 8 * 3600000

    // ===== Dashboard tooltips & icons =====
    const COST_TIP = '费用按 vibe-usage-model-pricing-extended.csv 定价表估算（CNY 直接定价）；DeepSeek 现行两型号（deepseek-flash、deepseek-v4-pro）按峰谷计费（工作日高峰 9:00-12:00、14:00-18:00，北京时间，周末及其余时段为空闲（高峰一半）），V4.1 Flash 新价自 2026-09-10 12:00 起、V4 Pro 自 2026-09-14 12:00 起路由到 Flash 计费；已下线的旧名（deepseek-v4-flash / -vision-exp）与第三方变体名同样按 Flash 计费；未匹配模型暂不计费。点击卡片切换 ¥/＄。'
    const DUR_TIP = '会话时长说明：活跃时长 = 模型生成区间（请求发出 → 回复完成）的累计时长，不含工具执行时间；旧版日志带输出分块时从首个分块起算（不含排队与首 Token 延迟）。并行会话的生成时间会分别累加，因此可能超过 24H。总时长 = 各会话首条到末条消息的时间跨度，重叠（并行）会话只计一次后相加（含思考、看代码等空闲）。'
    const TOTAL_TIP = '会话时长说明：总时长 = 每个会话从首条消息到末条消息的时间跨度，先合并重叠区间（并行会话只计一次）再相加；包含中间思考、看代码等空闲时间，但不包含会话之间的间隔，不会超过所选时间范围。'
    const ICON_ECG = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('polyline', { points: '22 12 18 12 15 21 9 3 6 12 2 12' }))
    const ICON_CAL = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('rect', { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2 }), h('line', { x1: 16, y1: 2, x2: 16, y2: 6 }), h('line', { x1: 8, y1: 2, x2: 8, y2: 6 }), h('line', { x1: 3, y1: 10, x2: 21, y2: 10 }))
    const ICON_MODEL = h('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('rect', { x: 6, y: 6, width: 12, height: 12, rx: 2 }), h('path', { d: 'M9 2v4M15 2v4M2 9h4M2 15h4M18 9h4M18 15h4M9 18v4M15 18v4' }))
    const ICON_PROJECT = h('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.25, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z' }))
    const ARROW = h('svg', { width: 8, height: 8, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M6 9l6 6 6-6' }))
    const CHECK = h('svg', { width: 9, height: 9, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 3.5, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M20 6L9 17l-5-5' }))
    const ICON_INFO = h('svg', { width: 11, height: 11, viewBox: '0 0 10 10', fill: 'none' }, h('path', { d: 'M3.5 3.25a1.5 1.5 0 1 1 2 1.41c-.3.12-.5.4-.5.74V6', stroke: 'currentColor', strokeWidth: 1, strokeLinecap: 'round', strokeLinejoin: 'round' }), h('circle', { cx: 5, cy: 7.5, r: 0.6, fill: 'currentColor' }))
    const ICON_PIE = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M21.21 15.89A10 10 0 1 1 8 2.83' }), h('path', { d: 'M22 12A10 10 0 0 0 12 2v10z' }))
    const ICON_GRID = h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('rect', { x: 3, y: 3, width: 7, height: 7 }), h('rect', { x: 14, y: 3, width: 7, height: 7 }), h('rect', { x: 14, y: 14, width: 7, height: 7 }), h('rect', { x: 3, y: 14, width: 7, height: 7 }))

    const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const HEAT_SCALES = {
      tokens: ['transparent', '#e4e4e7', '#d4d4d8', '#b8b8bd', '#9ca3af', '#7e8794', '#646b78', '#52525b'],
      cost: ['transparent', '#d1fae5', '#a7f3d0', '#6ee7b7', '#34d399', '#10b981', '#059669', '#047857'],
      dur: ['transparent', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8']
    }
    const BREAK_PTS = [0, 15, 30, 45, 60, 75, 90, 100]
    const TREND_SEG_COLORS = {
      output: '#18181b', input: '#71717a', cache: '#d4d4d8',
      cost: '#10b981', durActive: '#3b82f6', durTotal: 'rgba(59,130,246,0.25)'
    }
    const MODES = [
      { key: 'token', label: 'Token' },
      { key: 'cost', label: '费用' },
      { key: 'dur', label: '时长' }
    ]
    const RANGES = [
      { key: 'today', label: '今天', title: '今日 00:00 至今' },
      { key: '24h', label: '24H', title: '最近 24 小时（滚动窗口，含昨天同时段）' },
      { key: '7d', label: '7D', title: '最近 7 天（滚动窗口）' },
      { key: '30d', label: '30D', title: '最近 30 天（滚动窗口）' },
      { key: '90d', label: '90D', title: '最近 90 天（滚动窗口）' },
      { key: 'custom', label: '自定义', title: '自定义起止日期' }
    ]


    // The DSH settings shell currently gives unknown section ids its gear icon
    // and does not expose an icon slot. Replace only this section's shell icon
    // with a matching 16px grid glyph, restoring the original on disposal.
    function installDashboardNavIcon() {
      if (typeof document === 'undefined' || !document.body || typeof MutationObserver === 'undefined') return () => {}
      const patched = []
      const ns = 'http://www.w3.org/2000/svg'
      const patch = () => {
        for (const button of document.querySelectorAll('button')) {
          if ((button.textContent || '').trim() !== '数据看板') continue
          const old = button.querySelector('svg')
          if (!old || old.getAttribute('data-dd-dashboard-icon') === 'true') continue
          const svg = document.createElementNS(ns, 'svg')
          for (const [name, value] of [['width', '16'], ['height', '16'], ['viewBox', '0 0 16 16'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.4'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true'], ['data-dd-dashboard-icon', 'true']]) svg.setAttribute(name, value)
          for (const [x, y] of [[2.5, 2.5], [9, 2.5], [9, 9], [2.5, 9]]) {
            const rect = document.createElementNS(ns, 'rect')
            rect.setAttribute('x', String(x)); rect.setAttribute('y', String(y)); rect.setAttribute('width', '4.5'); rect.setAttribute('height', '4.5'); rect.setAttribute('rx', '0.6')
            svg.appendChild(rect)
          }
          const className = old.getAttribute('class')
          if (className) svg.setAttribute('class', className)
          old.replaceWith(svg)
          patched.push({ button, old, svg })
        }
      }
      patch()
      // The observer fires for every DOM mutation while ANY chat streams.
      // Coalesce bursts into one scan per frame so patch() can never run
      // dozens of times per paint.
      let queued = 0
      const observer = new MutationObserver(() => {
        if (queued) return
        queued = requestAnimationFrame(() => { queued = 0; patch() })
      })
      observer.observe(document.body, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
        if (queued) cancelAnimationFrame(queued)
        for (const item of patched) if (item.svg.isConnected && item.button.contains(item.svg)) item.svg.replaceWith(item.old)
      }
    }
    // 分布卡片固定色板：蓝 绿 橙 红 紫 黄；第 7+ 项聚合为「其他」（黑灰，不显示具体名称）
    const DIST_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#eab308', '#52525b']
    const DIST_NAMED_LIMIT = 6
    // 活跃热力图 8 阶色阶：空白与 Token 量分开，后续档位按每日绝对 Token 量递增。
    // 1M/10M/30M/60M/100M/200M/250M 能覆盖常见工作日到高峰日的实际使用区间。
    const CAL_LEVELS = [
      { min: 0, label: '无 Token', color: '#EAEDEF' },
      { min: 1000000, label: '≥ 1M', color: '#DDF3E5' },
      { min: 10000000, label: '≥ 10M', color: '#B8E6C8' },
      { min: 30000000, label: '≥ 30M', color: '#86D2A5' },
      { min: 60000000, label: '≥ 60M', color: '#55BA83' },
      { min: 100000000, label: '≥ 100M', color: '#2D9F68' },
      { min: 200000000, label: '≥ 200M', color: '#1D7D50' },
      { min: 250000000, label: '≥ 250M', color: '#125E3B' }
    ]
    function calLevel(tokens) {
      let lv = 0
      for (let i = CAL_LEVELS.length - 1; i >= 0; i--) {
        if (tokens >= CAL_LEVELS[i].min) { lv = i; break }
      }
      return lv
    }

    function pad2(n) { return n < 10 ? '0' + n : String(n) }
    function fmtH9(e) {
      e = Number(e) || 0
      if (e >= 1e9) return (e / 1e9).toFixed(1) + 'B'
      if (e >= 1e6) return (e / 1e6).toFixed(1) + 'M'
      if (e >= 1e3) return (e / 1e3).toFixed(1) + 'K'
      return String(e)
    }
    function fmtIntl(e) { return new Intl.NumberFormat('en-US').format(Math.round(Number(e) || 0)) }
    // 宿主成本为人民币；$ = ÷7 固定汇率
    function fmtUsd(n) {
      const c = (Number(n) || 0) / 7
      if (c === 0) return '$0.00'
      if (c < 0.01) return '$' + c.toFixed(4)
      return '$' + c.toFixed(2)
    }
    function fmtCny(n) {
      const c = Number(n) || 0
      if (c === 0) return '¥0.00'
      if (c < 0.01) return '¥' + c.toFixed(4)
      return '¥' + c.toFixed(2)
    }
    function fmtDur(sec) {
      sec = Math.floor(Number(sec) || 0)
      if (sec < 60) return sec + 's'
      const hh = Math.floor(sec / 3600)
      const mm = Math.floor((sec % 3600) / 60)
      if (hh === 0) return mm + 'm'
      return mm > 0 ? hh + 'h ' + mm + 'm' : hh + 'h'
    }
    function fmtPct(v) {
      if (v == null) return null
      const n = Math.abs(v)
      const s = n >= 100 ? String(Math.round(n)) + '%' : n.toFixed(1) + '%'
      return (v > 0 ? '+' : v < 0 ? '-' : '') + s
    }
    function fmtPrice(v) {
      if (!(v > 0)) return '-'
      const s = String(v)
      return '¥' + s + '/M'
    }
    function fmtZhTokens(tokens) {
      const count = Math.trunc(Number(tokens) || 0)
      if (!Number.isFinite(count) || count < 0) return '—'
      if (count < 1000) return String(count)
      const units = [
        { factor: 1e12, suffix: '万亿' },
        { factor: 1e8, suffix: '亿' },
        { factor: 1e7, suffix: '千万' },
        { factor: 1e4, suffix: '万' },
        { factor: 1e3, suffix: '千' }
      ]
      let idx = 0
      while (idx < units.length - 1 && count < units[idx].factor) idx += 1
      while (true) {
        const unit = units[idx]
        const coeff = round3(count / unit.factor)
        const rounded = coeff * unit.factor
        const next = units[idx - 1]
        if (next && rounded >= next.factor) { idx -= 1; continue }
        const s = coeff % 1 === 0 ? String(Math.round(coeff)) : coeff.toFixed(1).replace(/\.0$/, '')
        return s + unit.suffix
      }
    }
    function round3(v) {
      const f = Math.pow(10, 3 - Math.floor(Math.log10(Math.abs(v))) - 1)
      return Math.round((v + Number.EPSILON * Math.max(1, Math.abs(v)) * 10) * f) / f
    }
    // 数字滚动动画：目标值变化时从当前值丝滑过渡（easeOutCubic），切换时间范围数字从小到大/从大到小过渡；
    // 目标归零时直接跳变——避免「大数字闪成 0」的拖尾长串数字
    function useTween(target, dur) {
      const [v, setV] = React.useState(0)
      const cur = React.useRef(0)
      React.useEffect(() => {
        const from = cur.current
        const to = Number(target) || 0
        if (to === 0) { cur.current = 0; setV(0); return }
        if (from === to) { setV(to); return }
        const t0 = performance.now()
        let raf = 0
        const step = (t) => {
          const p = Math.min(1, (t - t0) / dur)
          const e = 1 - Math.pow(1 - p, 3)
          const val = from + (to - from) * e
          cur.current = val
          setV(val)
          if (p < 1) raf = requestAnimationFrame(step)
        }
        raf = requestAnimationFrame(step)
        return () => { if (raf) cancelAnimationFrame(raf) }
      }, [target, dur])
      return v
    }
    function bjDate(t) { return new Date(t + BJ_OFFSET) }
    function bjMidnight(y, m, d) { return Date.UTC(y, m, d) - BJ_OFFSET }
    function fmtDateParts(y, m, d) { return y + '-' + pad2(m + 1) + '-' + pad2(d) }
    function fmtDateMs(t) {
      const d = bjDate(t)
      return fmtDateParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
    function fmtDT(t) {
      const d = bjDate(t)
      const now = bjDate(Date.now())
      const sameDay = d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCDate() === now.getUTCDate()
      const hm = pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes())
      return sameDay ? hm : (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + hm
    }
    // 详细记录时间桶标签：小时桶 → 8月14日 21:00；天桶 → 8月10日 00:00
    function fmtBucket(t, gran) {
      const d = bjDate(t)
      const md = (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日'
      return gran === 'hour' ? md + ' ' + pad2(d.getUTCHours()) + ':00' : md + ' 00:00'
    }
    function fmtDate(d) {
      return fmtDateParts(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    }
    function defaultCustom() {
      const now = bjDate(Date.now())
      const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate()
      const from = new Date(Date.UTC(y, m, d - 6))
      const to = new Date(Date.UTC(y, m, d))
      return {
        fromStr: fmtDate(from), from: bjMidnight(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()),
        toStr: fmtDate(to), to: bjMidnight(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate() + 1) - 1
      }
    }
    function dateToMs(str, endOfDay) {
      const parts = String(str || '').split('-')
      if (parts.length !== 3) return null
      const y = Number(parts[0]), m = Number(parts[1]), d = Number(parts[2])
      if (!y || !m || !d) return null
      return endOfDay ? bjMidnight(y, m - 1, d + 1) - 1 : bjMidnight(y, m - 1, d)
    }
    function axisLabel(label, gran) {
      if (gran === 'hour') return pad2(Number(label)) + ':00'
      return label
    }
    function heatBreakpoints(values) {
      const t = values.filter((v) => v > 0).sort((a, b) => a - b)
      if (t.length === 0) return []
      return BREAK_PTS.map((p) => t[Math.min(Math.floor(p / 100 * t.length), t.length - 1)])
    }
    function heatColor(v, bps, colors) {
      if (v <= 0 || bps.length === 0) return colors[0]
      for (let s = colors.length - 1; s >= 1; s--) {
        if (v >= bps[s]) return colors[s]
      }
      return colors[1]
    }

    function Segmented(props) {
      return h('div', { className: 'dd-seg-group', role: 'group', 'aria-label': props.ariaLabel },
        props.options.map((m) => h('button', {
          key: m.key,
          type: 'button',
          className: 'dd-seg-btn' + (props.active === m.key ? ' on' : ''),
          'aria-pressed': props.active === m.key,
          onClick: () => props.onSelect(m.key)
        }, m.icon || null, m.label)))
    }

    function Dropdown(props) {
      const open = !!props.open
      const menu = open ? h('div', { className: 'dd-drop-menu' },
        props.options.map((o) => h('button', {
          key: o.key,
          type: 'button',
          className: 'dd-drop-item' + (o.active ? ' on' : ''),
          onClick: () => { props.onSelect(o.key); props.onToggle(false) }
        },
        h('span', { className: 'dd-check' }, o.active ? CHECK : null),
        h('span', { className: 'label' }, o.label),
        o.sub ? h('span', { className: 'sub' }, o.sub) : null))) : null
      return h('div', { className: 'dd-drop' },
        h('button', { type: 'button', className: 'dd-drop-btn' + (open ? ' open' : ''), onClick: () => props.onToggle(!open) },
          h('span', { className: 'dd-drop-icon' }, props.icon),
          h('span', { className: 'dd-drop-label' }, props.title),
          h('span', { className: 'dd-drop-value' }, props.value),
          h('span', { className: 'dd-drop-arrow' }, ARROW)),
        menu)
    }

    // 模型多选下拉：按系列（厂商，来自 pricing CSV）分组，系列可展开勾选具体模型；
    // 选中后按钮只显示「模型 N项」（灰色），不显示具体模型名
    function ModelSelect(props) {
      const [open, setOpen] = React.useState(false)
      const [expanded, setExpanded] = React.useState({})
      const selected = props.selected || []
      const models = props.models || []
      const vendors = props.vendors || {}
      const seriesMap = new Map()
      for (const m of models) {
        const s = vendors[m.id] || '其他'
        let arr = seriesMap.get(s)
        if (!arr) { arr = []; seriesMap.set(s, arr) }
        arr.push(m.id)
      }
      const series = Array.from(seriesMap.entries())
        .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'zh'))
      const toggle = (id) => {
        const has = selected.indexOf(id) >= 0
        const next = has ? selected.filter((x) => x !== id) : selected.concat(id)
        props.onSelect(next.length ? next : null)
      }
      return h('div', { className: 'dd-drop' },
        h('button', {
          type: 'button',
          className: 'dd-drop-btn' + (open ? ' open' : ''),
          onClick: () => setOpen(!open)
        },
          h('span', { className: 'dd-drop-icon' }, props.icon),
          h('span', { className: 'dd-drop-label' }, '模型'),
          selected.length > 0 ? h('span', { className: 'dd-drop-count' }, selected.length + '项') : h('span', { className: 'dd-drop-value' }, '全部'),
          h('span', { className: 'dd-drop-arrow' }, ARROW)),
        open ? h('div', { className: 'dd-model-menu' },
          h('div', { className: 'dd-model-actions' },
            h('button', { type: 'button', className: 'link', onClick: () => props.onSelect(null) }, '全部'),
            // 全选 == 不过滤：置空而非把全部模型 id 塞进查询串（245+ id 会逼近 URL/头部上限）
            h('button', { type: 'button', className: 'link', onClick: () => props.onSelect(null) }, '全选'),
            h('span', { className: 'spacer' }),
            h('span', { className: 'cnt' }, '已选 ' + selected.length + ' 项')),
          h('div', { className: 'dd-model-scroll' },
            series.map(([name, ids]) => {
              const isOpen = expanded[name] === true
              return h('div', { key: name, className: 'dd-series' },
                h('button', {
                  type: 'button',
                  className: 'dd-series-head',
                  onClick: () => setExpanded(Object.assign({}, expanded, { [name]: !isOpen }))
                },
                  h('span', { className: 'chev' + (isOpen ? ' open' : '') }, ARROW),
                  h('span', { className: 'name' }, name),
                  h('span', { className: 'cnt' }, ids.length)),
                isOpen ? h('div', { className: 'dd-series-body' },
                  ids.map((id) => h('label', { key: id, className: 'dd-model-item' },
                    h('input', { type: 'checkbox', checked: selected.indexOf(id) >= 0, onChange: () => toggle(id) }),
                    h('span', { className: 'lbl' }, id)))) : null)
            }))) : null)
    }

    function FilterBar(props) {
      const r = props.range
      const meta = props.meta || { models: [], projects: [], vendors: {} }
      const [openDrop, setOpenDrop] = React.useState(null)
      const [draftCustom, setDraftCustom] = React.useState(props.custom)
      React.useEffect(() => setDraftCustom(props.custom), [props.custom.from, props.custom.to, props.custom.fromStr, props.custom.toStr])
      const projectOptions = [{ key: 'all', label: '全部' }].concat(meta.projects.map((p) => ({ key: p.id, label: p.title, sub: p.sessions + ' 会话' })))
      const proj = meta.projects.find((p) => p.id === props.projectSel)
      const projectValue = proj ? proj.title : (props.projectSel || '全部')
      const customRow = r === 'custom' ? h('div', { className: 'dd-custom' },
        h('input', { type: 'date', value: draftCustom.fromStr, onChange: (e) => setDraftCustom({ fromStr: e.target.value, from: dateToMs(e.target.value, false), toStr: draftCustom.toStr, to: draftCustom.to }) }),
        h('span', { className: 'sep' }, '–'),
        h('input', { type: 'date', value: draftCustom.toStr, onChange: (e) => setDraftCustom({ fromStr: draftCustom.fromStr, from: draftCustom.from, toStr: e.target.value, to: dateToMs(e.target.value, true) }) }),
        h('div', { className: 'dd-spacer' }),
        h('button', { type: 'button', className: 'apply', onClick: () => props.onApply(draftCustom) }, '应用')) : null
      const hasFilter = (props.modelSel && props.modelSel.length) || props.projectSel
      return h('div', { className: 'dd-filters' },
        h('div', { className: 'dd-range' },
          RANGES.map((x) => h('button', {
            key: x.key,
            type: 'button',
            title: x.title,
            className: 'dd-pill' + (r === x.key ? ' on' : ''),
            onClick: () => props.setRange(x.key)
          }, x.label))),
        customRow,
        h('div', { className: 'dd-spacer' }),
        h('div', { className: 'dd-filter-row' },
          h(ModelSelect, {
            icon: ICON_MODEL,
            selected: props.modelSel,
            models: meta.models,
            vendors: meta.vendors,
            onSelect: props.setModelSel
          }),
          h(Dropdown, {
            open: openDrop === 'project', onToggle: (v) => setOpenDrop(v ? 'project' : null),
            icon: ICON_PROJECT, title: '项目', value: projectValue,
            options: projectOptions,
            onSelect: (k) => props.setProjectSel(k === 'all' ? null : k)
          }),
          hasFilter ? h('button', { type: 'button', className: 'dd-clear', onClick: () => { props.setModelSel(null); props.setProjectSel(null) } }, '清除') : null,
          props.busy ? h('span', { className: 'dd-busy' }, h('span', { className: 'spinner' }), '统计中') : null))
    }

    // 点击弹出的信息面板（fixed 定位，点击外部关闭；视口内防溢出）
    function Popup(props) {
      const [pos, setPos] = React.useState(null)
      const btnRef = React.useRef(null)
      React.useEffect(() => {
        if (!props.open) { setPos(null); return }
        const el = btnRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const w = props.width || 320
        const left = Math.min(Math.max(r.left, 8), Math.max(8, window.innerWidth - w - 8))
        setPos({ left: left, top: r.bottom + 8 })
      }, [props.open])
      React.useEffect(() => {
        if (!props.open || !pos) return
        const el = document.querySelector('.dd-pop')
        if (!el) return
        const hh = el.getBoundingClientRect().height
        const maxTop = window.innerHeight - hh - 8
        if (pos.top > maxTop) setPos({ left: pos.left, top: Math.max(8, maxTop) })
      }, [props.open, pos])
      React.useEffect(() => {
        if (!props.open) return
        const onDoc = (e) => {
          const t = e.target
          if (!t || typeof t.closest !== 'function') return
          if (!t.closest('.dd-pop') && t !== btnRef.current) props.onClose()
        }
        document.addEventListener('mousedown', onDoc)
        return () => document.removeEventListener('mousedown', onDoc)
      }, [props.open])
      return h('span', { className: 'dd-info-wrap' },
        h('button', {
          ref: btnRef,
          type: 'button',
          className: 'dd-info',
          'aria-label': '详情',
          title: props.tip,
          onClick: (e) => { e.stopPropagation(); props.onToggle() }
        }, ICON_INFO),
        props.open && pos ? h('div', { className: 'dd-pop', style: { left: pos.left, top: pos.top, width: props.width || 320 } }, props.children) : null)
    }

    function DurPopup() {
      return h('div', null,
        h('div', { className: 'pop-title' }, '会话时长说明'),
        h('div', { className: 'pop-body' },
          h('div', { className: 'pop-sec', style: { marginTop: 0 } },
            h('div', { className: 'sec-title' }, '活跃时长'),
            h('div', null, '模型每完成一次回复（step）记一段生成时间：从请求发出到回复完毕，之后的工具执行不计入。旧版日志保留了输出分块事件时，从 AI 开始输出算起，不含排队等待与首 Token 延迟（TTFT）。两次 prompt 之间的空闲不计入；并行会话分别累加，所以活跃时长可能超过 24H。')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '总时长'),
            h('div', null, '总时长 = 各会话从首条消息到末条消息的时间跨度，先合并重叠区间（并行会话只计一次）再相加。包含中间思考、看代码等空闲时间，但不包含会话之间的间隔，不会超过所选时间范围。'))))
    }

    function fmtPriceRange(off, peak) {
      const f = (n) => String(n).replace(/\.0+$/, '')
      return '¥' + f(off) + '~' + f(peak) + '/M'
    }
    function PricingPopup(props) {
      const pricing = props.pricing || { coverage: 0, rows: [] }
      const rows = pricing.rows || []
      const hasDs = rows.some((r) => r.ds)
      const cell = (r, i) => r.ds ? fmtPriceRange(r.off[i], r.peak[i]) : (r.p ? fmtPrice(r.p[i]) : '-')
      return h('div', null,
        h('div', { className: 'pop-title' }, '模型定价匹配'),
        h('div', { className: 'pop-body' },
          h('div', null, '当前定价覆盖 ' + pricing.coverage + '% 的 Token 用量，未匹配的模型暂不计费。'),
          hasDs ? h('div', { className: 'pop-sec', style: { marginTop: 6 } }, 'DeepSeek 现行两型号按峰谷计费：高峰 9:00-12:00、14:00-18:00（北京时间），空闲为高峰一半；表中 ¥a~b/M 为空闲~高峰。V4.1 Flash 新价自 2026-09-10 12:00 起生效；V4 Pro 自 2026-09-14 12:00 起路由到 Flash 并按 Flash 单价计费。') : null),
        h('table', null,
          h('thead', null, h('tr', null,
            h('th', null, '模型'),
            h('th', null, '匹配'),
            h('th', null, '输入'),
            h('th', null, '输出'),
            h('th', null, '缓存'))),
          h('tbody', null, rows.map((r) => h('tr', { key: r.model },
            h('td', { className: 'mdl' }, r.model),
            h('td', null, r.matched || '未匹配'),
            h('td', null, cell(r, 0)),
            h('td', null, cell(r, 1)),
            h('td', null, cell(r, 2)))))))
    }

    function StatCard(props) {
      const cls = 'dd-kpi' + (props.onClick ? ' clickable' : '')
      const pct = props.pct
      const pv = useTween(pct == null ? 0 : pct, 500)
      const pctEl = pct == null ? null : h('span', { className: 'pct ' + (pct > 0 ? 'dd-pct-up' : pct < 0 ? 'dd-pct-down' : 'dd-pct-flat') }, fmtPct(pv))
      const val = useTween(props.num, 600)
      const [open, setOpen] = React.useState(false)
      const info = props.popup ? h(Popup, {
        open: open,
        onToggle: () => setOpen(!open),
        onClose: () => setOpen(false),
        width: props.popupWidth || 320,
        tip: props.tip,
        children: props.popup
      }) : null
      return h('div', {
         className: cls,
         onClick: props.onClick,
         role: props.onClick ? 'button' : undefined,
         tabIndex: props.onClick ? 0 : undefined,
         'aria-label': props.onClick ? props.title + '，点击切换显示单位' : undefined,
         onKeyDown: props.onClick ? (e) => {
           if (e.key === 'Enter' || e.key === ' ') {
             e.preventDefault()
             props.onClick()
           }
         } : undefined
       },
        h('div', { className: 'dd-kpi-label' },
          h('span', { className: 'lt' },
            h('span', null, props.title),
            info),
          pctEl),
        h('div', { className: 'dd-kpi-value' + (props.color ? ' ' + props.color : '') }, props.fmt(val)))
    }

    function TrendChart(props) {
      const buckets = props.buckets || []
      const gran = props.granularity || 'week'
      const [mode, setMode] = React.useState('token')
      const [segs, setSegs] = React.useState({ output: true, input: true, cache: true })
      const [durSegs, setDurSegs] = React.useState({ active: true, total: true })
      // 点击柱子：选中高亮（其他柱子变淡），再点一次或点空白处恢复
      const [sel, setSel] = React.useState(null)
      React.useEffect(() => { setSel(null) }, [buckets])
      const isDur = mode === 'dur'
      const isCost = mode === 'cost'
      const title = gran === 'hour' ? '每小时趋势' : gran === 'day' ? '每日趋势' : '每周趋势'

      let M = 1
      if (isDur) {
        M = Math.max.apply(null, buckets.map((w) => durSegs.total ? w.totalMs : durSegs.active ? w.activeMs != null ? w.activeMs : w.durMs : 0)) || 1
      } else if (isCost) {
        M = Math.max.apply(null, buckets.map((w) => w.costIn + w.costOut + w.costCache)) || 0.01
      } else {
        M = Math.max.apply(null, buckets.map((w) => (segs.input ? w.input : 0) + (segs.output ? w.output : 0) + (segs.cache ? w.cache : 0))) || 1
      }
      const n = buckets.length
      // 今天/24H 底部均匀 8 个时间点；7D/30D/90D 均匀 7 个
      // 今天/24H 底部按固定步长标注（24 小时 → 每 3 小时一格），7D/30D/90D 同理；
      // 旧的「均匀取点再舍入」会让时间跳距忽大忽小（03→07→10），看起来像漏标。
      const labelCount = gran === 'hour' ? 8 : 7
      const labelStep = Math.max(1, Math.ceil(n / labelCount))
      const labelIdx = n <= labelCount ? null : Array.from({ length: Math.ceil(n / labelStep) }, (_, k) => k * labelStep)

      const head = h('div', { className: 'dd-chart-head' },
        h('div', { className: 'dd-chart-title' },
          h('span', { className: 'icon' }, ICON_ECG),
          h('span', null, title)),
        h('div', { className: 'dd-chart-tools' },
          !isDur && !isCost ? h('div', { className: 'dd-legend' },
            [{ key: 'output', label: '输出', color: TREND_SEG_COLORS.output },
             { key: 'input', label: '输入', color: TREND_SEG_COLORS.input },
             { key: 'cache', label: '缓存', color: TREND_SEG_COLORS.cache }].map((s) => h('button', {
              key: s.key,
              type: 'button',
              title: (segs[s.key] ? '隐藏' : '显示') + s.label,
              className: 'dd-legend-btn' + (segs[s.key] ? '' : ' off'),
              onClick: () => setSegs(Object.assign({}, segs, { [s.key]: !segs[s.key] }))
            },
            h('span', { className: 'dd-swatch', style: { backgroundColor: s.color } }),
            h('span', null, s.label)))) : null,
          isDur ? h('div', { className: 'dd-legend' },
            [{ key: 'active', label: '活跃时长', color: '#60a5fa' },
             { key: 'total', label: '总时长', color: 'rgba(96,165,250,0.3)' }].map((s) => h('button', {
              key: s.key,
              type: 'button',
              title: (durSegs[s.key] ? '隐藏' : '显示') + s.label,
              className: 'dd-legend-btn' + (durSegs[s.key] ? '' : ' off'),
              onClick: () => setDurSegs(Object.assign({}, durSegs, { [s.key]: !durSegs[s.key] }))
            },
            h('span', { className: 'dd-swatch', style: { backgroundColor: s.color } }),
            h('span', null, s.label)))) : null,
          h(Segmented, { ariaLabel: '趋势指标', options: MODES, active: mode, onSelect: setMode })))

      if (buckets.length === 0) {
        return h('div', { className: 'dd-chart' }, head, h('div', { className: 'dd-empty' }, '暂无数据'))
      }

      const yTop = isDur ? fmtDur(M / 1000) : isCost ? fmtCny(M) : fmtH9(M)
      const yBot = isCost ? '¥0' : '0'

      const cols = buckets.map((w, i) => {
        // 三种模式共用固定三个段槽（key a/b/c）：切换模式时 React 复用同一批 DOM 节点，
        // .dd-seg 的 height/backgroundColor 过渡才能真正生效。此前各模式 key 不同
        // （token=0/1/2、cost=0、dur=total/active），跨模式切换整列重建，动画丢失。
        const segStyle = (hFrac, bg, rad) => ({
          height: Math.max(0, hFrac * 100) + '%',
          backgroundColor: bg,
          borderRadius: hFrac > 0 && rad > 0 ? rad + 'px ' + rad + 'px 0 0' : '0'
        })
        let segsEl
        if (isDur) {
          // 总时长是背景，活跃时长是其子集，使用底部叠覆而不是相加堆叠。
          const totalH = durSegs.total ? w.totalMs / M : 0
          const activeH = durSegs.active ? (w.activeMs != null ? w.activeMs : w.durMs) / M : 0
          segsEl = h('div', { className: 'dd-bar-inner' },
            h('div', { key: 'a', className: 'dd-seg', style: segStyle(totalH, TREND_SEG_COLORS.durTotal, Math.min(4, totalH * 220 / 2)) }),
            h('div', { key: 'b', className: 'dd-seg dd-seg-overlay', style: segStyle(activeH, TREND_SEG_COLORS.durActive, Math.min(4, activeH * 220 / 2)) }),
            h('div', { key: 'c', className: 'dd-seg', style: segStyle(0, TREND_SEG_COLORS.cache, 0) }))
        } else {
          let segArr
          if (isCost) {
            segArr = [{ h: (w.costIn + w.costOut + w.costCache) / M, bg: TREND_SEG_COLORS.cost }, { h: 0, bg: TREND_SEG_COLORS.input }, { h: 0, bg: TREND_SEG_COLORS.cache }]
          } else {
            segArr = [
              { h: segs.output ? w.output / M : 0, bg: TREND_SEG_COLORS.output },
              { h: segs.input ? w.input / M : 0, bg: TREND_SEG_COLORS.input },
              { h: segs.cache ? w.cache / M : 0, bg: TREND_SEG_COLORS.cache }
            ]
          }
          // 自适应顶部圆角：顶部段太矮时圆角随高度收缩，避免短段被 4px 圆角剪成“尖尖”凸出
          let topIdx = -1
          for (let j = 0; j < segArr.length; j++) {
            if (segArr[j].h > 0) { topIdx = j; break }
          }
          const rad = topIdx >= 0 ? Math.min(4, segArr[topIdx].h * 220 / 2) : 0
          segsEl = h('div', { className: 'dd-bar-inner' },
            segArr.map((s, j) => h('div', {
              key: j === 0 ? 'a' : j === 1 ? 'b' : 'c',
              className: 'dd-seg',
              style: segStyle(s.h, s.bg, j === topIdx ? rad : 0)
            })))
        }
        let tipRows = null
        if (isDur) {
          tipRows = [
            h('div', { key: 'a', className: 'tt-dur' }, '活跃: ' + fmtDur((w.activeMs != null ? w.activeMs : w.durMs) / 1000)),
            h('div', { key: 't', className: 'tt-dur2' }, '总时长: ' + fmtDur(w.totalMs / 1000)),
            h('div', { key: 'c', className: 'tt-row' }, '会话: ' + fmtIntl(w.sessions))
          ]
        } else if (isCost) {
          tipRows = [h('div', { key: 'cost', className: 'tt-cost' }, '费用: ' + fmtCny(w.costIn + w.costOut + w.costCache))]
        } else {
          tipRows = [
            h('div', { key: 't', className: 'tt-row' }, '总 Token: ' + fmtIntl(w.input + w.output + w.cache)),
            h('div', { key: 'i', className: 'tt-row' }, '输入: ' + fmtIntl(w.input)),
            h('div', { key: 'o', className: 'tt-row' }, '输出: ' + fmtIntl(w.output)),
            h('div', { key: 'c', className: 'tt-row' }, '缓存: ' + fmtIntl(w.cache)),
            h('div', { key: 'cost', className: 'tt-cost' }, '费用: ' + fmtCny(w.costIn + w.costOut + w.costCache))
          ]
        }
        return h('div', {
          key: gran + ':' + i + ':' + w.label,
          className: 'dd-col' + (sel !== null && sel !== i ? ' dim' : ''),
          onClick: (e) => { e.stopPropagation(); setSel(sel === i ? null : i) }
        },
          segsEl,
          h('div', { className: 'dd-tip' },
            h('div', { className: 'tt-title' }, axisLabel(w.label, gran)),
            tipRows))
      })

      const xrow = h('div', { className: 'dd-x' },
        h('div', { className: 'labels' },
          labelIdx ? labelIdx.map((idx) => {
            // 标签居中对齐所属列的列心（列是等宽 flex，列心 = (idx+0.5)/n）
            return h('div', {
              key: idx,
              className: 'cell abs',
              style: { left: ((idx + 0.5) * 100 / n).toFixed(2) + '%' }
            }, h('span', null, axisLabel(buckets[idx].label, gran)))
          }) : buckets.map((w, i) => h('div', { key: i, className: 'cell' },
            h('span', null, axisLabel(w.label, gran))))))

      return h('div', { className: 'dd-chart' },
        head,
        h('div', { className: 'dd-plot-row' },
          h('div', { className: 'dd-y' }, h('span', null, yTop), h('span', null, yBot)),
          h('div', { className: 'dd-plot', onClick: () => setSel(null) }, cols)),
        xrow)
    }

    function HeatChart(props) {
      const heat = props.heat || null
      const [mode, setMode] = React.useState('token')
      const cells = heat ? (mode === 'dur' ? (Array.isArray(heat.active) ? heat.active : heat.dur) : heat[mode]) : null
      const colors = HEAT_SCALES[mode] || HEAT_SCALES.tokens
      const bps = cells ? heatBreakpoints(cells) : []
      const head = h('div', { className: 'dd-chart-head' },
        h('div', { className: 'dd-chart-title' },
          h('span', { className: 'icon' }, ICON_CAL),
          h('span', null, '分时活跃')),
        h('div', { className: 'dd-chart-tools' },
          h(Segmented, { ariaLabel: '热力图指标', options: MODES, active: mode, onSelect: setMode })))
      const tipLabel = mode === 'cost' ? '费用' : mode === 'dur' ? '活跃' : 'Token'
      const tipCls = mode === 'cost' ? 'tt-cost' : mode === 'dur' ? 'tt-dur' : 'tt-token'
      const tipVal = (v) => mode === 'cost' ? fmtCny(v) : mode === 'dur' ? fmtDur(v / 1000) : fmtIntl(v)
      const rows = cells ? DAYS.map((d, di) => h('div', { key: d, className: 'dd-heat-row' },
        h('span', { className: 'dd-heat-day' }, d),
        h('div', { className: 'dd-heat-cells' },
          Array.from({ length: 24 }, (_, hh) => {
            const v = cells[di * 24 + hh]
            return h('div', { key: hh, className: 'dd-heat-cell' + (hh === 0 ? ' edge-left' : hh === 23 ? ' edge-right' : '') },
              h('div', { className: 'inner', style: { backgroundColor: heatColor(v, bps, colors) } }),
              h('div', { className: 'tip' },
                h('div', { className: 'tt-title' }, d + ' ' + pad2(hh) + ':00'),
                h('div', { className: tipCls }, tipLabel + ': ' + tipVal(v))))
          })))) : null
      const xrow = h('div', { className: 'dd-heat-x' },
        h('div', { className: 'labels' },
          Array.from({ length: 24 }, (_, hh) => h('div', { key: hh, className: 'cell' },
            hh % 3 === 0 ? h('span', null, pad2(hh)) : null))))
      return h('div', { className: 'dd-chart' },
        head,
        cells ? h('div', { className: 'dd-heat' },
          rows,
          xrow,
          h('div', { className: 'dd-heat-legend' },
            h('span', { className: 'lbl' }, '少'),
            h('div', { className: 'dots' }, colors.slice(1).map((c, i) => h('span', { key: i, className: 'dd-dot', style: { backgroundColor: c } }))),
            h('span', { className: 'lbl' }, '多'))) : h('div', { className: 'dd-empty' }, '暂无数据'))
    }

    // 圆环图：按占比切分描边弧段（自顶部顺时针）；dim 段变暗（hover 联动）
    function Donut(props) {
      const items = props.items || []
      const total = items.reduce((s, x) => s + x.v, 0)
      const R = 44
      const C = 2 * Math.PI * R
      let acc = 0
      const segs = items.map((x, i) => {
        const frac = total > 0 ? x.v / total : 0
        const len = frac > 0 ? Math.max(0, frac * C - 1.5) : 0
        const circleProps = {
          key: i,
          cx: 60, cy: 60, r: R,
          fill: 'none',
          stroke: x.color,
          strokeWidth: 15,
          strokeDasharray: len + ' ' + C,
          strokeDashoffset: -acc,
          strokeLinecap: 'butt',
          opacity: x.dim ? 0.18 : 1,
          role: x.ariaLabel ? 'img' : undefined,
          'aria-label': x.ariaLabel,
          onMouseEnter: x.onMouseEnter,
          onMouseLeave: x.onMouseLeave,
          onFocus: x.onMouseEnter,
          onBlur: x.onMouseLeave,
          tabIndex: x.ariaLabel ? 0 : undefined
        }
        const seg = x.title ? h('circle', circleProps, h('title', null, x.title)) : h('circle', circleProps)
        acc += frac * C
        return seg
      })
      return h('svg', { width: 120, height: 120, viewBox: '0 0 120 120' },
        h('g', { transform: 'rotate(-90 60 60)' }, segs))
    }

    // 分布卡片：左侧圆环 + 右侧图例（名称 … Token量 占比），右上角 Token/费用 切换
    // 颜色固定：蓝 绿 橙 红 紫 黄 各对应前 6 项；其余聚合为「其他」（黑灰，不显示具体名称）
    function DistributionCard(props) {
      const [mode, setMode] = React.useState('token')
      const [hover, setHover] = React.useState(null)
      const raw = props.items || []
      const sorted = raw.map((x) => {
        const tokens = Number(x.tokens) || 0
        const cost = Number(x.cost) || 0
        return { id: x.id, label: x.label || x.id, tokens, cost, v: mode === 'cost' ? cost : tokens }
      })
        .filter((x) => x.v > 0)
        .sort((a, b) => b.v - a.v || String(a.label).localeCompare(String(b.label)))
      const items = []
      for (let i = 0; i < sorted.length; i++) {
        const x = sorted[i]
        if (i < DIST_NAMED_LIMIT) {
          items.push({ id: x.id, label: x.label, tokens: x.tokens, cost: x.cost, v: x.v, color: DIST_COLORS[i] })
        } else {
          let o = items.find((y) => y.id === '__other__')
          if (!o) {
            o = { id: '__other__', label: '其他', tokens: 0, cost: 0, v: 0, color: DIST_COLORS[DIST_NAMED_LIMIT] }
            items.push(o)
          }
          o.tokens += x.tokens
          o.cost += x.cost
          o.v += x.v
        }
      }
      const total = items.reduce((s, x) => s + x.v, 0)
      const totalTokens = items.reduce((s, x) => s + x.tokens, 0)
      const totalCost = items.reduce((s, x) => s + x.cost, 0)
      const hoverItem = hover === null ? null : items.find((x) => x.id === hover) || null
      const activeHover = hoverItem ? hover : null
      const centerTarget = hoverItem || { tokens: totalTokens, cost: totalCost }
      const centerValue = mode === 'cost' ? fmtCny(centerTarget.cost) : fmtH9(centerTarget.tokens)
       const centerLabel = hoverItem
         ? (mode === 'cost' ? '当前费用' : '当前 Token')
         : (mode === 'cost' ? '总费用' : '总 Token')
       const opts = [{ key: 'token', label: 'Token' }, { key: 'cost', label: '费用' }]
      const pctLabel = (x) => (total > 0 ? (x.v / total * 100).toFixed(1) : '0.0') + '%'
      const fullLabel = (x) => (x.id === '__other__' ? '其他（聚合）' : x.label) + '：Token ' + fmtIntl(x.tokens) + '，费用 ' + fmtCny(x.cost) + '，占比 ' + pctLabel(x)
      const totalLabel = (mode === 'cost' ? '总费用 ' + fmtCny(totalCost) + '，Token ' + fmtIntl(totalTokens) : '总 Token ' + fmtIntl(totalTokens) + '，费用 ' + fmtCny(totalCost))
      const centerTitle = hoverItem ? fullLabel(hoverItem) : totalLabel
      const head = h('div', { className: 'dd-chart-head' },
        h('div', { className: 'dd-chart-title' },
          h('span', { className: 'icon' }, props.icon || ICON_PIE),
          h('span', null, props.title)),
        h('div', { className: 'dd-chart-tools' },
          h(Segmented, { ariaLabel: props.title + '指标', options: opts, active: mode, onSelect: setMode })))
      let body
      if (items.length === 0) {
        body = h('div', { className: 'dd-empty' }, '暂无数据')
      } else {
        body = h('div', { className: 'dd-dist-body' },
          h('div', { className: 'dd-dist-donut' },
            h(Donut, { items: items.map((x) => ({
              v: x.v,
              color: x.color,
              dim: activeHover !== null && activeHover !== x.id,
              title: fullLabel(x),
              ariaLabel: fullLabel(x),
              onMouseEnter: () => setHover(x.id),
              onMouseLeave: () => setHover(null)
            })) }),
            h('div', { className: 'dd-dist-center', title: centerTitle, 'aria-label': centerTitle },
              h('span', { className: 'v' }, centerValue),
               h('span', { className: 'l' }, centerLabel))),
          h('div', { className: 'dd-dist-legend' },
            items.map((x) => {
              const label = fullLabel(x)
              return h('div', {
                key: x.id,
                className: 'dd-dist-item' + (activeHover !== null && activeHover !== x.id ? ' dim' : ''),
                title: label,
                'aria-label': label,
                onMouseEnter: () => setHover(x.id),
                onMouseLeave: () => setHover(null)
              },
                h('span', { className: 'dot', style: { backgroundColor: x.color } }),
                h('span', { className: 'name', title: x.label }, x.label),
                h('span', { className: 'val' }, mode === 'cost' ? fmtCny(x.cost) : fmtIntl(x.tokens)),
                h('span', { className: 'pct' }, pctLabel(x)))
            })))
      }
      return h('div', { className: 'dd-dist' }, head, body)
    }

    // Radar card v3 — six honest axes, real-value vertex chips, numeric card.
    // 每轴：score（0–1，双端固定标定的对数带宽归一）+ fmt（顶点真值标签）。
    // 对数带宽 score = log(v/floor)/log(ceil/floor)：两端都定标（外圈=快/多/省，
    // 中心=floor），比值类轴（如 1/P50 跨两个数量级）不再全员贴中心。
    // 标定基准（2026-09-12，90d + 当日窗口实测分布）：
    //   响应速度 外圈 P50=1s / 中心 120s；输出速度 1–166 t/s；平均输出量 50–1645 tok；
    //   平均输入量 5k–29.4万 tok；稳定性 慢125倍–慢8.3倍；实际单价 ¥2/M–¥0.10/M。
    // 方向统一：越靠外圈越好。平均输出/输入量是使用画像而非强弱（弹窗注明）。
    const RADAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
    const RADAR_AXES = 6
    const RADAR_ANGLE_STEP = (2 * Math.PI) / RADAR_AXES
    const RADAR_ANGLE_OFF = -Math.PI / 2
    const RADAR_PLOT = 420
    const RADAR_CX = RADAR_PLOT / 2, RADAR_CY = RADAR_PLOT / 2, RADAR_R = 165
    const RADAR_LABEL_R = RADAR_R + 42
    const RADAR_BAND = (v, floor, ceil) => (v == null || !(v > 0)) ? null
      : Math.max(0, Math.min(1, Math.log(v / floor) / Math.log(ceil / floor)))
    const RADAR_DEFS = [
      { name: '响应速度',
        score: m => m.p50ResponseMs > 0 ? Math.max(0, Math.min(1, Math.log(120000 / m.p50ResponseMs) / Math.log(120))) : null,
        fmt: m => m.p50ResponseMs > 0 ? (m.p50ResponseMs / 1000).toFixed(1) + 's' : null },
      { name: '输出速度',
        score: m => m.responseMsSum > 0 ? RADAR_BAND(m.output * 1000 / m.responseMsSum, 1, 166) : null,
        fmt: m => m.responseMsSum > 0 ? Math.round(m.output * 1000 / m.responseMsSum) + ' t/s' : null },
      { name: '平均输出量',
        score: m => m.calls > 0 ? RADAR_BAND(m.output / m.calls, 50, 1645) : null,
        fmt: m => { if (!(m.calls > 0)) return null; const v = m.output / m.calls
          return (v >= 1000 ? (v / 1000).toFixed(1) + 'k' : String(Math.round(v))) + ' tok' } },
      { name: '平均输入量',
        score: m => m.calls > 0 ? RADAR_BAND(m.billedInput / m.calls, 5000, 293667) : null,
        fmt: m => m.calls > 0 ? (m.billedInput / m.calls / 10000).toFixed(1) + '万' : null },
      { name: '稳定性',
        score: m => m.p50ResponseMs > 0 && m.p95ResponseMs > m.p50ResponseMs
          ? RADAR_BAND(m.p50ResponseMs / m.p95ResponseMs, 0.008, 0.12) : null,
        fmt: m => m.p50ResponseMs > 0 && m.p95ResponseMs ? '慢' + Math.round(m.p95ResponseMs / m.p50ResponseMs) + '倍' : null },
      { name: '实际单价',
        score: m => { const tot = m.input + m.output + m.cache
          return m.cost > 0 && tot > 0 ? RADAR_BAND(1 / (m.cost / (tot / 1e6)), 0.5, 10) : null },
        fmt: m => { const tot = m.input + m.output + m.cache
          return m.cost > 0 && tot > 0 ? '¥' + (m.cost / (tot / 1e6)).toFixed(2) + '/M' : '未定价' } }
    ]
    function RadarCard(props) {
      const [hoverId, setHoverId] = React.useState(null)
      // 图例 hover 是「粘性聚焦」：移开鼠标仍保持高亮（否则用户把指针移向
      // 图形查看时高亮瞬间消失，看起来像 hover 失效）。点击 = 显式锁定。
      const [legendId, setLegendId] = React.useState(null)
      const [selectedId, setSelectedId] = React.useState(null)
      const [radarInfoOpen, setRadarInfoOpen] = React.useState(false)
      const toggleSelected = (id) => setSelectedId((prev) => (prev === id ? null : id))
      const models = props.models || []
      const modelSel = props.modelSel || null
      const filtered = modelSel && modelSel.length
        ? models.filter((m) => modelSel.indexOf(m.id) >= 0)
        : models
      const top = filtered.slice()
        .filter((m) => m.calls > 0 && m.output > 0)
        .sort((a, b) => b.calls - a.calls || a.id.localeCompare(b.id))
        .slice(0, 4)
      // 筛选变化后重置选中：选中的模型已不在 top 中时清空
      React.useEffect(() => {
        if (selectedId && !top.some((m) => m.id === selectedId)) setSelectedId(null)
      }, [selectedId, top])
      const COLORS = RADAR_COLORS
      const STROKE_COLORS = RADAR_COLORS
      const AXES = RADAR_AXES
      const ANGLE_STEP = RADAR_ANGLE_STEP
      const ANGLE_OFF = RADAR_ANGLE_OFF
      const DEFS = RADAR_DEFS
      const PLOT = RADAR_PLOT
      const CX = RADAR_CX, CY = RADAR_CY, R = RADAR_R
      const LABEL_R = RADAR_LABEL_R
      function axisAngle(i) { return ANGLE_OFF + i * ANGLE_STEP }
      function polar(r, a) { return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) } }
      const norms = top.map((m) => DEFS.map((d) => d.score(m)))
      const chipText = top.map((m) => DEFS.map((d) => d.fmt(m)))
      function makePoly(pts) {
        let d = ''
        let firstValid = true
        for (let i = 0; i < AXES; i++) {
          if (pts[i] == null) continue
          const a = axisAngle(i)
          const p = polar(R * pts[i], a)
          d += (firstValid ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2)
          firstValid = false
        }
        if (!firstValid) d += ' Z'
        return d
      }
      const rings = [0.2, 0.4, 0.6, 0.8, 1.0].map((f) => {
        const pts = Array.from({ length: AXES }, (_, i) => {
          const d = polar(R * f, axisAngle(i))
          return d.x.toFixed(2) + ',' + d.y.toFixed(2)
        }).join(' ')
        return h('polygon', { key: f, points: pts, style: { fill: 'none', stroke: f === 1 ? '#d4d4d8' : '#e9e9ec', strokeWidth: 1 } })
      })
      const axes = Array.from({ length: AXES }, (_, i) => {
        const end = polar(R, axisAngle(i))
        return h('line', { key: i, x1: CX, y1: CY, x2: end.x.toFixed(2), y2: end.y.toFixed(2), style: { stroke: '#e9e9ec', strokeWidth: 1 } })
      })
      // 当前展示模型（chart hover > 图例 hover > 点击锁定 > 第一个）
      const focusId = hoverId || legendId || selectedId
      const activeIdx = focusId ? top.findIndex((m) => m.id === focusId) : 0
      const activeModel = top[activeIdx] || null
      const labelEls = DEFS.map((d, i) => {
        const lp = polar(LABEL_R, axisAngle(i))
        const anchor = Math.abs(lp.x - CX) < 1 ? 'middle' : (lp.x > CX ? 'start' : 'end')
        return h('text', {
          key: i, x: lp.x.toFixed(2), y: (lp.y + 6).toFixed(2),
          'text-anchor': anchor, 'dominant-baseline': 'middle',
          style: { fontSize: '22px', fill: '#52525b', fontWeight: 600 }
        }, d.name)
      })
      // 外圈基准值不再画在图上（太杂乱），完整标定说明在 ⓘ 弹窗里
      const polys = top.map((m, idx) => {
        const d = makePoly(norms[idx])
        const isFocus = focusId != null && m.id === focusId
        const isDim = focusId !== null && m.id !== focusId
        if (!d) return null
        return h('path', {
          key: m.id, d,
          fill: COLORS[idx],
          fillOpacity: isDim ? 0.03 : (isFocus ? 0.20 : 0.13),
          stroke: STROKE_COLORS[idx],
          strokeOpacity: isDim ? 0.12 : 0.85,
          strokeWidth: isFocus ? 2 : 1.4,
          onMouseEnter: () => setHoverId(m.id),
          onMouseLeave: () => setHoverId(null)
        })
      }).filter(Boolean)
      const dots = top.map((m, idx) => norms[idx].map((v, ai) => {
        if (v == null) return null
        const p = polar(R * v, axisAngle(ai))
        const isH = focusId != null && m.id === focusId
        const isDim = focusId !== null && m.id !== focusId
        return h('circle', {
          key: m.id + '-' + ai, cx: p.x.toFixed(2), cy: p.y.toFixed(2), r: isH ? 3.5 : 2.5,
          fill: STROKE_COLORS[idx],
          fillOpacity: isDim ? 0.12 : 0.85,
          stroke: '#fff',
          strokeOpacity: isDim ? 0.15 : 1,
          strokeWidth: 1.2,
          style: { transition: 'fill-opacity .15s ease, stroke-opacity .15s ease' },
          onMouseEnter: () => setHoverId(m.id),
          onMouseLeave: () => setHoverId(null)
        })
      })).flat().filter(Boolean)
      // 顶点真值标签：安静风——白底细灰描边、墨色文字，无投影（最后绘制防遮挡）
      const chipEls = []
      if (activeModel && norms[activeIdx]) {
        norms[activeIdx].forEach((f, i) => {
          const text = chipText[activeIdx][i]
          if (f == null || text == null) return
          const p = polar(Math.min(Math.max(R * f, R * 0.32) + 20, R - 6), axisAngle(i))
          const w = Math.max(64, text.length * 12 + 26)
          chipEls.push(h('g', { key: i },
            h('rect', {
              x: (p.x - w / 2).toFixed(1), y: (p.y - 16).toFixed(1), width: w, height: 32, rx: 16,
              fill: '#ffffff', stroke: '#dcdce1', strokeWidth: 1
            }),
            h('text', {
              x: p.x.toFixed(1), y: (p.y + 5.8).toFixed(1), 'text-anchor': 'middle',
              style: { fontSize: '20px', fontWeight: 600, fill: '#3f3f46', fontFamily: '"JetBrains Mono",ui-monospace,monospace' }
            }, text)))
        })
      }
      const plotEl = h('svg', { viewBox: '-78 -25 583 470', style: { display: 'block', width: '100%', height: '100%' } },
        rings, axes, polys, dots, labelEls, chipEls)
      const legendEl = h('div', { className: 'dd-radar-legend', style: { display: 'flex', flexDirection: 'column', gap: 1 } },
        top.map((m, idx) => {
          const isDim = focusId !== null && m.id !== focusId
          return h('div', {
            key: m.id,
            className: 'dd-dist-item' + (isDim ? ' dim' : ''),
            style: { display: 'block', padding: '3px 8px', cursor: 'pointer' },
            onMouseEnter: () => setLegendId(m.id),
            onMouseLeave: () => setLegendId(null),
            onClick: () => toggleSelected(m.id),
            title: m.id + '\n' + DEFS.map((d, i) => d.name + ': ' + (chipText[idx][i] == null ? '—' : chipText[idx][i])).join('\n')
          },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
              h('span', { className: 'dot', style: { backgroundColor: STROKE_COLORS[idx], width: 8, height: 8, borderRadius: 99, flex: 'none' } }),
              h('span', { style: { fontSize: 11.5, fontWeight: 600, color: '#3f3f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.id)),
            h('div', { style: { fontSize: 10.5, color: '#a1a1aa', paddingLeft: 14 } }, m.calls.toLocaleString() + ' 次'))
        }))
      // 数值卡：每轴一行「标尺」——真值 + 轨道上全部模型的落点（当前模型放大带
      // 白圈光晕，其余半透明），主色淡填充到当前落点。比纯文字多了对比与量感。
      const numsEl = (activeModel && norms[activeIdx]) ? h('div', {
        style: { display: 'flex', flexDirection: 'column', fontSize: '11px', padding: '6px 10px 4px', border: '1px solid #ececee', borderRadius: 8, marginTop: 4, gap: 2 }
      },
        DEFS.map((d, i) => {
          const f = norms[activeIdx][i]
          const text = chipText[activeIdx][i]
          const dots = []
          for (let mi = 0; mi < top.length; mi++) {
            const v = norms[mi] ? norms[mi][i] : null
            if (v == null) continue
            const cur = mi === activeIdx
            dots.push(h('span', {
              key: mi,
              title: top[mi].id + ' · ' + d.name + ': ' + (chipText[mi][i] == null ? '—' : chipText[mi][i]),
              style: { position: 'absolute', top: '50%', left: (Math.max(0.015, Math.min(1, v)) * 100).toFixed(1) + '%', transform: 'translate(-50%,-50%)',
                width: cur ? 7 : 5, height: cur ? 7 : 5, borderRadius: 99, background: STROKE_COLORS[mi],
                opacity: cur ? 0.9 : 0.35, boxSizing: 'border-box',
                border: cur ? '1.5px solid #fff' : 'none',
                boxShadow: cur ? '0 0 0 1px ' + STROKE_COLORS[mi] + '66' : 'none', zIndex: cur ? 2 : 1 }
            }))
          }
          return h('div', { key: d.name, style: { padding: '2px 0 1px' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' } },
              h('span', { style: { color: '#71717a' } }, d.name),
              h('span', { style: { fontWeight: 700, fontFamily: '"JetBrains Mono",ui-monospace,monospace', color: f == null ? '#a1a1aa' : '#3f3f46', fontVariantNumeric: 'tabular-nums' } }, text == null ? '—' : text)),
            h('div', { style: { padding: '0 5px' } },
              h('div', { style: { position: 'relative', height: 11 } },
                h('span', { style: { position: 'absolute', left: 0, right: 0, top: '50%', height: 2, marginTop: -1, background: '#f0f0f2', borderRadius: 99 } }),
                f != null ? h('span', { style: { position: 'absolute', left: 0, top: '50%', height: 2, marginTop: -1, width: (Math.max(0.015, Math.min(1, f)) * 100).toFixed(1) + '%', background: STROKE_COLORS[activeIdx], opacity: 0.18, borderRadius: 99 } }) : null,
                dots)))
        })) : null
      const radarPopup = h('div', null,
        h('div', { className: 'pop-title' }, '雷达图六维度说明'),
        h('div', { className: 'pop-body' },
          h('div', { className: 'pop-sec', style: { marginTop: 0 } },
            h('div', { className: 'sec-title' }, '响应速度'),
            h('div', null, '一次请求通常要等多久（中位数）。外圈 = 1 秒')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '输出速度'),
            h('div', null, '模型每秒吐出多少 tokens。外圈 = 166 tok/s')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '平均输出量'),
            h('div', null, '平均每次回复写多少 tokens。外圈 = 1,645 tok/次')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '平均输入量'),
            h('div', null, '平均每次读入多少 tokens。外圈 = 29.4 万 tok/次')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '稳定性'),
            h('div', null, '最慢的 5% 请求比典型请求慢几倍。外圈 = 慢 ≤8.3 倍')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '实际单价'),
            h('div', null, '每百万 tokens 实际花多少钱。外圈 = ¥0.10/M'))))
      const radarInfo = h(Popup, {
        open: radarInfoOpen,
        onToggle: () => setRadarInfoOpen(!radarInfoOpen),
        onClose: () => setRadarInfoOpen(false),
        width: 300,
        children: radarPopup
      })
      const head = h('div', { className: 'dd-chart-head' },
        h('div', { className: 'dd-chart-title' },
          h('span', { className: 'icon' }, ICON_MODEL),
          h('span', null, '模型效能雷达'),
          radarInfo))
      if (top.length === 0) {
        return h('div', { className: 'dd-radar' },
          head,
          h('div', { className: 'dd-empty' }, '暂无可用模型数据'))
      }
      return h('div', {
        className: 'dd-radar',
        // 图例悬停是即时的：放上高亮该模型，移开即恢复全览（item 级 mouseleave）。
        // 卡级 leave 只作兜底（指针从图例直接飞出窗口等场景）。点击 = 显式锁定。
        onMouseLeave: () => setLegendId(null)
      },
        head,
        h('div', { className: 'dd-radar-body', style: { display: 'flex', alignItems: 'center', gap: 12 } },
          h('div', { className: 'dd-radar-donut', style: { width: 250, height: 250, flex: 'none' } }, plotEl),
          h('div', { style: { flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column' } },
            legendEl,
            numsEl)))
    }

    // 缓存洞察：KPI 条 + 双视图（命中率/用量）+ 自适应 Y 轴 + 模型缓存排行（点击筛选）
    function CacheTrendCard(props) {
      const buckets = props.buckets || []
      const granularity = props.granularity || 'week'
      const totals = props.totals || {}
      const usd = !!props.usd
      const CACHE_DOT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#d946ef', '#64748b']
      const fmtCostShort = (v) => {
        const r = Math.round(usd ? v / 7 : v)
        return (usd ? '$' : '¥') + r.toLocaleString('en-US')
      }
      // 预计节省：缓存读取 token × (输入价 − 缓存价)；未定价模型 null（显示 —），免费模型如实 0
      const savedOf = (m) => m.p ? Math.max(0, (m.cacheRead || 0) * (m.p[0] - m.p[2]) / 1e6) : null
      const cacheModels = (props.models || [])
        .filter((m) => (m.cacheRead || 0) > 0)
        .sort((a, b) => b.cacheRead - a.cacheRead)
      const totalSaved = cacheModels.reduce((s, m) => { const v = savedOf(m); return v ? s + v : s }, 0)

      const [view, setView] = React.useState('hit')   // 'hit' | 'vol'
      const [switchSeq, setSwitchSeq] = React.useState(0) // 视图切换计数：作为动画层的 remount key，让入场动画每次切换都重播
      const [hoverIdx, setHoverIdx] = React.useState(null)
      const [expanded, setExpanded] = React.useState(false)
      const [infoOpen, setInfoOpen] = React.useState(false)

      const W = 460, H = 152, PAD = { top: 12, right: 14, bottom: 22, left: 38 }
      const PW = W - PAD.left - PAD.right
      const PH = H - PAD.top - PAD.bottom
      const n = buckets.length
      const toX = (i) => PAD.left + (i / Math.max(1, n - 1)) * PW
      function axisLabel(label, gran) {
        if (gran === 'hour') return pad2(Number(label)) + ':00'
        if (gran === 'week') {
          // "8/11-8/17" → "8/11"，只显示起始日期，避免标签过长重叠
          const m = label.match(/^(\d+\/\d+)/)
          return m ? m[1] : label
        }
        return label
      }

      // 有遥测的桶（命中率 + 覆盖率共同决定自适应域）
      const hitVals = []
      for (let i = 0; i < n; i++) {
        const b = buckets[i]
        if (b.cacheHitRate != null && b.cacheObserved > 0) { hitVals.push(b.cacheHitRate); hitVals.push(b.cacheCoverage || 0) }
      }
      const cacheInfo = h('div', null,
        h('div', { className: 'pop-title' }, '缓存指标说明'),
        h('div', { className: 'pop-body' },
          h('div', { className: 'pop-sec', style: { marginTop: 0 } },
            h('div', { className: 'sec-title' }, '命中率'),
            h('div', null, '能走缓存的输入 tokens 里，直接由缓存供上的比例。越高说明同样的上下文没有重复花钱。')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '覆盖率'),
            h('div', null, '计费输入中，模型上报了缓存遥测的比例。没上报的部分不计入命中率，避免把未知当成未命中。')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '预计节省'),
            h('div', null, '若缓存未命中，这些 tokens 要按各模型输入价付费，差额即节省。免费/开源模型输入本就不计费，节省为 ¥0。')),
          h('div', { className: 'pop-sec' },
            h('div', { className: 'sec-title' }, '模型排行条'),
            h('div', null, '条长 = 该模型缓存读取量的相对大小；琥珀色刻度 = 它的覆盖率；点击行可按该模型筛选全看板。'))))
      const mkHead = () => h('div', { className: 'dd-chart-head', style: { marginBottom: 12 } },
        h('div', { className: 'dd-chart-title' },
          h('span', { className: 'icon' }, ICON_ECG),
          h('span', null, '缓存洞察'),
          h(Popup, {
            open: infoOpen,
            onToggle: () => setInfoOpen(!infoOpen),
            onClose: () => setInfoOpen(false),
            width: 320,
            tip: '缓存指标说明',
            children: cacheInfo
          })),
        h('div', { className: 'dd-chart-tools' },
          h(Segmented, {
            ariaLabel: '缓存视图',
            options: [{ key: 'hit', label: '命中率' }, { key: 'vol', label: '用量' }],
            active: view,
            onSelect: (k) => { if (k === view) return; setView(k); setSwitchSeq((v) => v + 1); setHoverIdx(null) }
          })))
      if (n === 0) {
        return h('div', { className: 'dd-chart' }, mkHead(), h('div', { className: 'dd-cache-empty' }, '暂无数据'))
      }

      function niceDomain(vals) {
        let lo = 100, hi = 0
        for (const v of vals) { if (v < lo) lo = v; if (v > hi) hi = v }
        const span = Math.max(4, hi - lo)
        const step = span <= 6 ? 2 : span <= 15 ? 5 : 10
        const dLo = Math.max(0, Math.floor((lo - span * 0.15) / step) * step)
        let dHi = Math.min(100, Math.ceil((hi + span * 0.15) / step) * step)
        if (dHi <= dLo) dHi = Math.min(100, dLo + step * 2)
        return [dLo, dHi]
      }
      const domain = (view === 'hit' && hitVals.length) ? niceDomain(hitVals) : [0, 100]
      const toY = (v) => v == null ? null : PAD.top + PH * (1 - (Math.max(domain[0], Math.min(domain[1], v)) - domain[0]) / (domain[1] - domain[0]))
      const tickVals = []
      for (let k = 0; k <= 4; k++) tickVals.push(Math.round(domain[0] + (domain[1] - domain[0]) * k / 4))

      // monotone cubic（Fritsch–Carlson）：平滑但不越过数据点
      function smooth(pts) {
        const m = pts.length
        if (m < 2) return ''
        const dx = [], sl = []
        for (let i = 0; i < m - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; sl[i] = (pts[i + 1][1] - pts[i][1]) / dx[i] }
        const t = [sl[0]]
        for (let i = 1; i < m - 1; i++) t[i] = (sl[i - 1] * sl[i] <= 0) ? 0 : (sl[i - 1] + sl[i]) / 2
        t[m - 1] = sl[m - 2]
        for (let i = 0; i < m - 1; i++) if (sl[i] === 0) { t[i] = 0; t[i + 1] = 0 }
        let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1)
        for (let i = 0; i < m - 1; i++) {
          const h3 = dx[i] / 3
          d += ' C' + (pts[i][0] + h3).toFixed(1) + ' ' + (pts[i][1] + t[i] * h3).toFixed(1) +
            ' ' + (pts[i + 1][0] - h3).toFixed(1) + ' ' + (pts[i + 1][1] - t[i + 1] * h3).toFixed(1) +
            ' ' + pts[i + 1][0].toFixed(1) + ' ' + pts[i + 1][1].toFixed(1)
        }
        return d
      }
      function segsOf(get) {
        const out = []
        for (let i = 0; i < n; i++) {
          const b = buckets[i]
          if (b.cacheHitRate == null) continue
          const p = [toX(i), toY(get(b))]
          const last = out[out.length - 1]
          if (last && last.end === i - 1) { last.end = i; last.pts.push(p) }
          else out.push({ start: i, end: i, pts: [p] })
        }
        return out
      }
      const hitSegs = segsOf((b) => b.cacheHitRate)
      const covSegs = segsOf((b) => b.cacheCoverage)
      const base = PAD.top + PH
      const hitPaths = hitSegs.map((s) => smooth(s.pts))
      const covPaths = covSegs.map((s) => smooth(s.pts))
      const areaDs = hitSegs.filter((s) => s.pts.length >= 2).map((s) =>
        smooth(s.pts) + ' L' + s.pts[s.pts.length - 1][0].toFixed(1) + ' ' + base + ' L' + s.pts[0][0].toFixed(1) + ' ' + base + ' Z')
      const hitBuckets = buckets.filter((b) => b.cacheHitRate != null)
      const hitAvg = hitBuckets.length ? hitBuckets.reduce((s, b) => s + b.cacheHitRate, 0) / hitBuckets.length : null

      // 无遥测区间的浅灰带
      const gapBands = []
      {
        let i = 0
        while (i < n) {
          if (buckets[i].cacheHitRate != null) { i++; continue }
          const st = i
          while (i < n && buckets[i].cacheHitRate == null) i++
          const x1 = st === 0 ? PAD.left : (toX(st - 1) + toX(st)) / 2
          const x2 = i >= n ? W - PAD.right : (toX(i - 1) + toX(i)) / 2
          gapBands.push([x1, x2])
        }
      }
      const lastSeg = hitSegs[hitSegs.length - 1]
      const lastIdx = lastSeg ? lastSeg.end : null

      // ---- 用量视图几何 ----
      const vol = buckets.map((b) => {
        const read = b.cacheRead || 0
        return { read, miss: Math.max(0, (b.billedInput || 0) - read) }
      })
      let volMax = 0
      for (const v of vol) if (v.read + v.miss > volMax) volMax = v.read + v.miss
      volMax = Math.max(1, volMax)
      const toYV = (v) => PAD.top + PH * (1 - Math.min(1, v / volMax))
      // 用量视图用分带（band）刻度：柱心在等宽槽位中央，首柱不会像点刻度那样半截越出
      // 绘图区压住 Y 轴刻度标签（桶少柱宽时尤其明显）；宽度上限防止单桶时柱占满全图。
      const toXB = (i) => PAD.left + (i + 0.5) * PW / n
      const BW = Math.min(26, Math.max(3, PW / n * 0.62))
      const volTick = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ y: PAD.top + PH * (1 - f), v: volMax * f }))

      // ---- 轴与标签 ----
      const MIN_LABEL_GAP = 44
      const maxLabels = Math.max(3, Math.floor(PW / MIN_LABEL_GAP))
      // 固定步长抽样：每隔 labelStep 个桶标一个刻度（今天 24 小时 → 每 3 小时一格）。
      // 此前「均匀取 maxLabels 个点再四舍五入」会产生 1/2/3 混合间隔，轴上看起来有的显示有的突然不显示。
      const labelStep = Math.max(1, Math.ceil(n / maxLabels))
      const labelIdx = n > maxLabels
        ? Array.from({ length: Math.ceil(n / labelStep) }, (_, k) => k * labelStep)
        : null
      const mkXLabels = (toFn) => (labelIdx || Array.from({ length: n }, (_, i) => i)).map((idx) =>
        h('text', { key: 'x' + idx, x: toFn(idx), y: PAD.top + PH + 15, 'text-anchor': 'middle', style: { fontSize: '10px', fill: '#9ca3af' } }, axisLabel(buckets[idx].label, granularity)))
      const hitGridEls = tickVals.map((v, i) => h('g', { key: 'y' + i },
        h('line', { x1: PAD.left, y1: toY(v), x2: W - PAD.right, y2: toY(v), style: { stroke: '#f0f0f2', strokeWidth: 1 } }),
        h('text', { x: PAD.left - 5, y: toY(v) + 3, 'text-anchor': 'end', style: { fontSize: '9px', fill: '#9ca3af' } }, v + '%')))
      const volGridEls = volTick.map((t, i) => h('g', { key: 'y' + i },
        h('line', { x1: PAD.left, y1: t.y, x2: W - PAD.right, y2: t.y, style: { stroke: '#f0f0f2', strokeWidth: 1 } }),
        h('text', { x: PAD.left - 5, y: t.y + 3, 'text-anchor': 'end', style: { fontSize: '9px', fill: '#9ca3af' } }, fmtH9(t.v))))

      // ---- hover ----
      const hoverB = hoverIdx != null ? buckets[hoverIdx] : null
      let tipEl = null
      if (hoverB) {
        const tipTime = granularity === 'hour' ? pad2(Number(hoverB.label)) + ':00' : hoverB.label
        const noData = hoverB.cacheHitRate == null
        const pct = (view === 'hit' ? toX(hoverIdx) : toXB(hoverIdx)) / W * 100
        const tx = pct < 30 ? 'translateX(-12%)' : pct > 70 ? 'translateX(-88%)' : 'translateX(-50%)'
        tipEl = h('div', {
          className: 'dd-cache-tip',
          style: { position: 'absolute', left: pct.toFixed(1) + '%', top: 6, transform: tx, pointerEvents: 'none' }
        },
          h('div', { className: 'dd-cache-tip-line' }, tipTime),
          view === 'hit'
            ? h('div', { key: 'r1', style: { fontSize: '11px', color: noData ? '#a1a1aa' : '#18181b', whiteSpace: 'nowrap', fontWeight: noData ? '400' : '600' } }, '命中率: ' + (noData ? '无遥测' : hoverB.cacheHitRate.toFixed(1) + '%'))
            : h('div', { key: 'r1', style: { fontSize: '11px', color: '#047857', whiteSpace: 'nowrap', fontWeight: '600' } }, '缓存读取: ' + fmtH9(hoverB.cacheRead || 0)),
          view === 'hit'
            ? h('div', { key: 'r2', style: { fontSize: '11px', color: '#71717a', whiteSpace: 'nowrap' } }, '缓存读取: ' + fmtH9(hoverB.cacheRead || 0))
            : h('div', { key: 'r2', style: { fontSize: '11px', color: '#71717a', whiteSpace: 'nowrap' } }, '未命中输入: ' + fmtH9(Math.max(0, (hoverB.billedInput || 0) - (hoverB.cacheRead || 0)))),
          view === 'hit'
            ? h('div', { key: 'r3', style: { fontSize: '11px', color: '#71717a', whiteSpace: 'nowrap' } }, '覆盖率: ' + (!noData && hoverB.cacheCoverage != null ? hoverB.cacheCoverage.toFixed(1) + '%' : '—'))
            : h('div', { key: 'r3', style: { fontSize: '11px', color: '#71717a', whiteSpace: 'nowrap' } }, '命中率: ' + (noData ? '无遥测' : hoverB.cacheHitRate.toFixed(1) + '%')))
      }
      const guideX = hoverIdx != null ? (view === 'hit' ? toX(hoverIdx) : toXB(hoverIdx)) : 0
      const guideLine = hoverIdx != null ? h('line', {
        key: 'guide', x1: guideX, y1: PAD.top, x2: guideX, y2: base,
        style: { stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '3 3', opacity: 0.6 }
      }) : null
      const hoverRect = h('rect', {
        key: 'hit-area',
        x: PAD.left, y: PAD.top, width: PW, height: PH,
        style: { fill: 'transparent', cursor: 'crosshair' },
        onMouseMove: (e) => {
          const svgEl = e.currentTarget.closest('svg')
          if (!svgEl) return
          const rect = svgEl.getBoundingClientRect()
          const mx = (e.clientX - rect.left) / rect.width * W
          // 命中率视图是点刻度（round 最近点）；用量视图是分带刻度（floor 落在哪个槽位）
          const idx = view === 'hit'
            ? Math.round(((mx - PAD.left) / PW) * (n - 1))
            : Math.floor(((mx - PAD.left) / PW) * n)
          setHoverIdx(Math.max(0, Math.min(n - 1, idx)))
        },
        onMouseLeave: () => setHoverIdx(null)
      })

      // ---- SVG 内容：两个视图层常驻，交叉淡入淡出；激活层通过 CSS 动画重播入场效果 ----
      // 折线用 pathLength=1 归一化后动画 stroke-dashoffset（描边生长）；柱子 scaleY 从基线弹起并按索引错峰。
      // 基态样式 = 动画终态，所以淡出的旧层立即呈现完整图形、只走 opacity 过渡。
      const hitLayer = h('g', { key: 'Lhit', className: 'ddc-layer' + (view === 'hit' ? ' on' : '') }, [
        gapBands.map(([x1, x2], i) => h('rect', { key: 'gap' + i, x: x1, y: PAD.top, width: Math.max(0, x2 - x1), height: PH, style: { fill: '#fafafa' } })),
        h('g', { key: 'grid' }, hitGridEls),
        h('g', { key: 'area' }, areaDs.map((d, i) => h('path', { key: 'ar' + i, className: 'ddc-area', d, style: { fill: 'url(#ddCacheGrad)' } }))),
        h('g', { key: 'cov', className: 'ddc-cov' }, covPaths.map((d, i) => h('path', { key: 'cov' + i, d, style: { stroke: '#f59e0b', strokeWidth: 1.4, fill: 'none', strokeDasharray: '4 3', opacity: 0.8 } }))),
        hitAvg != null && hitAvg > domain[0] && hitAvg < domain[1] ? h('g', { key: 'avg', className: 'ddc-area' },
          h('line', { x1: PAD.left, x2: W - PAD.right, y1: toY(hitAvg), y2: toY(hitAvg), style: { stroke: '#a1a1aa', strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.55 } }),
          h('text', { x: PAD.left + 4, y: toY(hitAvg) - 3, 'text-anchor': 'start', style: { fontSize: '9px', fill: '#a1a1aa' } }, '均值 ' + hitAvg.toFixed(1) + '%')) : null,
        h('g', { key: 'lines' }, hitPaths.map((d, i) => h('path', {
          key: 'ln' + i, className: 'ddc-line', d, pathLength: 1,
          style: { stroke: '#10b981', strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: 1, strokeDashoffset: 0 }
        }))),
        h('g', { key: 'dots', className: 'ddc-area' }, buckets.map((b, i) => b.cacheHitRate == null
          ? h('circle', { key: 'd' + i, cx: toX(i), cy: base, r: 2, style: { fill: 'none', stroke: '#d4d4d8', strokeWidth: 1.5 } })
          : i === lastIdx ? null : h('circle', { key: 'd' + i, cx: toX(i), cy: toY(b.cacheHitRate), r: hoverIdx === i ? 4 : 2.4, style: { fill: '#10b981', stroke: '#fff', strokeWidth: 1.2 } }))),
        lastIdx != null ? h('g', { key: 'ld', className: 'ddc-area' }, hoverIdx === lastIdx
          ? h('circle', { cx: toX(lastIdx), cy: toY(buckets[lastIdx].cacheHitRate), r: 4, style: { fill: '#10b981', stroke: '#fff', strokeWidth: 1.8 } })
          : [h('circle', { key: 'c', cx: toX(lastIdx), cy: toY(buckets[lastIdx].cacheHitRate), r: 4, style: { fill: '#10b981', stroke: '#fff', strokeWidth: 1.8 } }),
            (() => {
              const cw = 46
              const cx = Math.max(PAD.left, Math.min(W - PAD.right - cw, toX(lastIdx) - cw - 10))
              const cy = Math.max(1, toY(buckets[lastIdx].cacheHitRate) - 24)
              return [h('rect', { key: 'r', x: cx, y: cy, width: cw, height: 17, rx: 8.5, style: { fill: '#10b981' } }),
                h('text', { key: 't', x: cx + cw / 2, y: cy + 12, 'text-anchor': 'middle', style: { fontSize: '10px', fontWeight: '700', fill: '#fff' } }, buckets[lastIdx].cacheHitRate.toFixed(1) + '%')]
            })()]) : null,
        mkXLabels(toX)
      ])
      const volLayer = h('g', { key: 'Lvol', className: 'ddc-layer' + (view === 'vol' ? ' on' : '') }, [
        h('g', { key: 'grid' }, volGridEls),
        h('g', { key: 'bars' }, vol.map((v, i) => {
          const tot = v.read + v.miss
          if (!tot) return h('rect', { key: 'b' + i, x: toXB(i) - BW / 2, y: base - 2, width: BW, height: 2, rx: 1, style: { fill: '#f0f0f2' } })
          const yTot = toYV(tot), yRead = toYV(v.read)
          const dim = hoverIdx != null && hoverIdx !== i
          return h('g', { key: 'b' + i, className: 'ddc-bar', style: { opacity: dim ? 0.45 : 1, '--i': i } },
            h('rect', { x: toXB(i) - BW / 2, y: yTot, width: BW, height: Math.max(1, yRead - yTot), rx: 2, style: { fill: '#e4e4e7' } }),
            v.read > 0 ? h('rect', { x: toXB(i) - BW / 2, y: yRead, width: BW, height: Math.max(1, base - yRead), rx: 2, style: { fill: '#10b981', opacity: 0.85 } }) : null)
        })),
        mkXLabels(toXB)
      ])
      const svgKids = [
        h('defs', { key: 'defs' }, h('linearGradient', { id: 'ddCacheGrad', x1: '0', y1: '0', x2: '0', y2: '1' },
          h('stop', { offset: '0', 'stop-color': '#10b981', 'stop-opacity': '0.14' }),
          h('stop', { offset: '1', 'stop-color': '#10b981', 'stop-opacity': '0' }))),
        hitLayer,
        volLayer,
        guideLine,
        hoverRect
      ]

      // ---- KPI 条 ----
      const deltaPp = totals.cacheHitRateDeltaPp
      const kpi = (lab, valEl, hero) => h('div', { key: lab, className: 'dd-cache-kpi' + (hero ? ' hero' : '') },
        h('div', { className: 'lab' }, lab), h('div', { className: 'val' }, valEl))
      const kpis = view === 'hit'
        ? h('div', { key: 'k' + switchSeq, className: 'dd-cache-kpis ddc-in' },
            kpi('窗口命中率', totals.cacheHitRate != null
              ? [String(totals.cacheHitRate.toFixed(1)) + '%', deltaPp != null ? h('span', { key: 'd', className: 'delta ' + (deltaPp >= 0 ? 'up' : 'down') }, (deltaPp >= 0 ? '▲' : '▼') + Math.abs(deltaPp).toFixed(1) + 'pp') : null]
              : '—'),
            kpi('遥测覆盖率', totals.cacheCoverage > 0 ? totals.cacheCoverage.toFixed(1) + '%' : '—'),
            kpi('预计节省', cacheModels.length ? fmtCostShort(totalSaved) : '—', true))
        : h('div', { key: 'k' + switchSeq, className: 'dd-cache-kpis ddc-in' },
            kpi('缓存读取', (totals.cacheRead || totals.cacheReadTokens) ? fmtH9(totals.cacheRead || totals.cacheReadTokens) : '—'),
            kpi('计费输入', (totals.billedInput || totals.billedInputTokens) ? fmtH9(totals.billedInput || totals.billedInputTokens) : '—'),
            kpi('读取占比', totals.billedInput > 0 ? [String((100 * (totals.cacheRead || 0) / totals.billedInput).toFixed(1)), h('small', { key: 'u' }, '%')] : '—', true))

      const legend = view === 'hit'
        ? h('div', { key: 'g' + switchSeq, className: 'dd-cache-legend ddc-in' },
            h('span', { className: 'lg' }, h('i', { className: 'sw', style: { borderTopColor: '#10b981' } }), '命中率'),
            h('span', { className: 'lg' }, h('i', { className: 'sw', style: { borderTopColor: '#f59e0b', borderTopStyle: 'dashed' } }), '覆盖率'),
            h('span', { className: 'lg' }, h('i', { className: 'sw', style: { borderTopColor: '#a1a1aa', borderTopStyle: 'dotted' } }), '均值'))
        : h('div', { key: 'g' + switchSeq, className: 'dd-cache-legend ddc-in' },
            h('span', { className: 'lg' }, h('i', { className: 'sw blk', style: { background: '#10b981' } }), '缓存读取'),
            h('span', { className: 'lg' }, h('i', { className: 'sw blk', style: { background: '#e4e4e7' } }), '未命中计费输入'))

      // ---- 模型排行 ----
      let modelsEl = null
      if (cacheModels.length) {
        const sel = props.modelSel
        const shown = expanded ? cacheModels : cacheModels.slice(0, 5)
        const maxRead = cacheModels[0].cacheRead || 1
        modelsEl = h('div', { className: 'dd-cache-models' },
          h('div', { className: 'dd-cache-mtitle' },
            h('span', null, '模型缓存排行 · 按读取量'),
            cacheModels.length > 5 ? h('button', { type: 'button', className: 'dd-cache-zoom', onClick: () => setExpanded(!expanded) }, expanded ? '▴ 收起' : '▾ 全部 ' + cacheModels.length) : null),
          h('div', { className: 'dd-cache-mbody' + (expanded ? ' open' : '') }, shown.map((m, i) => {
            const isSel = Array.isArray(sel) && sel.length === 1 && sel[0] === m.id
            const sv = savedOf(m)
            const name = m.id.length > 16 ? m.id.slice(0, 15) + '…' : m.id
            const color = CACHE_DOT_COLORS[i % CACHE_DOT_COLORS.length]
            return h('div', {
              key: m.id, className: 'dd-cache-mrow' + (isSel ? ' sel' : ''),
              title: m.id + ' · 点击' + (isSel ? '取消筛选' : '按此模型筛选'),
              onClick: () => props.onPickModel && props.onPickModel(m.id)
            },
              h('span', { className: 'dot', style: { background: color } }),
              h('span', { className: 'mname' }, name),
              h('div', { className: 'mtrack' },
                h('div', { className: 'mfill', style: { width: Math.max(1.5, m.cacheRead / maxRead * 100).toFixed(1) + '%', background: color } }),
                m.cacheCoverage != null ? h('div', { className: 'mcov', style: { left: Math.min(98.5, Math.max(0.5, m.cacheCoverage)).toFixed(1) + '%' } }) : null),
              h('span', { className: 'mval' }, m.cacheHitRate != null ? m.cacheHitRate.toFixed(1) + '%' : '—'),
              h('span', { className: 'msave' }, sv == null ? '—' : '省 ' + fmtCostShort(sv)))
          })))
      }

      return h('div', { className: 'dd-chart' },
        mkHead(),
        kpis,
        legend,
        h('div', { className: 'dd-cache-chart', style: { position: 'relative', width: '100%' } },
          h('svg', { viewBox: '0 0 ' + W + ' ' + H, style: { display: 'block', width: '100%', height: 'auto' } }, svgKids),
          tipEl),
        modelsEl)
    }

    // 活跃热力图：最近 40 周的 7 行 × 40 列网格，周日起始，固定正方形单元格。
    function CalendarChart(props) {
      const [data, setData] = React.useState(null)
      const [tip, setTip] = React.useState(null)
      React.useEffect(() => {
        let alive = true
        host.call('calendar', {
          models: props.modelSel && props.modelSel.length ? props.modelSel : null,
          projects: props.projectSel ? [props.projectSel] : null
        }).then((r) => {
          if (alive) setData(r && !r.error ? r : null)
        }).catch(() => { if (alive) setData(null) })
        return () => { alive = false }
      }, [props.modelSel, props.projectSel, props.refreshSeq])
      const head = h('div', { className: 'dd-chart-head' },
        h('div', { className: 'dd-chart-title' },
          h('span', { className: 'icon' }, ICON_GRID),
          h('span', null, '活跃热力图')))
      if (!data || !data.start) {
        return h('div', { className: 'dd-chart' }, head, h('div', { className: 'dd-loading' }, '加载中...'))
      }
      const COLS = 40
      const dayMap = new Map()
      for (const dd of data.days || []) dayMap.set(dd.t, dd.tokens)
      const endDate = bjDate(data.end || Date.now())
      const endSunday = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() - endDate.getUTCDay()) - BJ_OFFSET
      const gridStart = endSunday - (COLS - 1) * 7 * 86400000
      const dayAt = (offset) => gridStart + offset * 86400000
      const showTip = (event, text) => {
        const box = event.currentTarget.getBoundingClientRect()
        const x = Math.max(12, Math.min(window.innerWidth - 12, box.left + box.width / 2))
        const above = box.top > 110
        setTip({ x, y: above ? box.top - 8 : box.bottom + 8, above, text })
      }
      const colsEl = Array.from({ length: COLS }, (_, c) => {
        const cells = Array.from({ length: 7 }, (_, r) => {
          const t = dayAt(c * 7 + r)
          const tokens = dayMap.get(t) || 0
          const lv = calLevel(tokens)
          const d = bjDate(t)
          const text = d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日：' + fmtIntl(tokens) + ' tokens'
          return h('div', {
            key: r,
            className: 'dd-cal-cell',
            style: { backgroundColor: CAL_LEVELS[lv].color },
            onMouseEnter: (e) => showTip(e, text),
            onMouseMove: (e) => showTip(e, text),
            onMouseLeave: () => setTip(null)
          })
        })
        return h('div', { key: c, className: 'dd-cal-col' }, cells)
      })
      return h('div', { className: 'dd-chart' },
        head,
        h('div', { className: 'dd-cal' },
          h('div', { className: 'dd-cal-body' },
            h('div', { className: 'dd-cal-cols' }, colsEl)),
          h('div', { className: 'dd-cal-legend' },
            h('span', { className: 'lbl' }, '少'),
            h('div', { className: 'dots' }, CAL_LEVELS.slice(1).map((l, i) => h('span', { key: i, className: 'dd-cal-dot', title: l.label, 'aria-label': l.label, style: { backgroundColor: l.color } }))),
            h('span', { className: 'lbl' }, '多'))),
        tip ? h('div', {
          className: 'dd-cal-floating-tip' + (tip.above ? '' : ' below'),
          style: { left: tip.x, top: tip.y }
        }, h('div', { className: 'tt-token' }, tip.text)) : null)
    }

    // 详细记录：时间 | 项目 | 模型 | 工具（固定 dsh）| 输入 | 输出 | 缓存 | 费用
    // 分页：每页 20 条；右上角「显示 x-y 条，共 z 条」，底部「上一页 p/n 下一页」
    function RecordsCard(props) {
      const PAGE = 20
      const [data, setData] = React.useState(null)
      const [loading, setLoading] = React.useState(true)
      const [page, setPage] = React.useState(1)
      const baseArgs = {
        range: props.range, from: props.custom.from, to: props.custom.to,
        models: props.modelSel && props.modelSel.length ? props.modelSel : null,
        projects: props.projectSel ? [props.projectSel] : null
      }
      const fetchPage = (p) => host.call('detail', Object.assign({}, baseArgs, { offset: (p - 1) * PAGE, limit: PAGE }))
      const fetchSeq = React.useRef(0)
      const pageRef = React.useRef(1)
      const filterKey = [props.range, props.custom.from, props.custom.to, JSON.stringify(props.modelSel || []), props.projectSel || ''].join('|')
      const filterKeyRef = React.useRef(null)
      React.useEffect(() => {
        const filterChanged = filterKeyRef.current !== filterKey
        filterKeyRef.current = filterKey
        const requestedPage = filterChanged ? 1 : pageRef.current
        if (filterChanged) {
          pageRef.current = 1
          setPage(1)
          setData(null)
        }
        const seq = ++fetchSeq.current
        let alive = true
        setLoading(true)
        fetchPage(requestedPage).then((r) => {
          if (alive && seq === fetchSeq.current) {
            setData({ rows: (r && r.rows) ? r.rows : [], total: (r && r.total) || 0, gran: (r && r.gran) || 'day' })
            setLoading(false)
          }
        }).catch(() => {
          if (alive && seq === fetchSeq.current) {
            setLoading(false)
            setData((d) => d || { rows: [], total: 0, gran: 'day' })
          }
        })
        return () => { alive = false }
      }, [filterKey, props.refreshSeq])
      const go = (p) => {
        if (p < 1) return
        pageRef.current = p
        fetchSeq.current += 1
        const seq = fetchSeq.current
        setPage(p)
        setLoading(true)
        fetchPage(p).then((r) => {
          if (seq !== fetchSeq.current) return
          setData({ rows: (r && r.rows) ? r.rows : [], total: (r && r.total) || 0, gran: (r && r.gran) || 'day' })
          setLoading(false)
        }).catch(() => { if (seq !== fetchSeq.current) return; setLoading(false); setData((d) => d || { rows: [], total: 0, gran: 'day' }) })
      }
      const rows = (data && data.rows) || []
      const total = (data && data.total) || 0
      const gran = (data && data.gran) || 'day'
      const pageCount = Math.max(1, Math.ceil(total / PAGE))
      const fmtCost = props.costMode === 'usd' ? fmtUsd : fmtCny
      const head = h('div', { className: 'dd-records-head' },
        h('div', { className: 'dd-records-title' },
          h('span', { className: 'icon' }, ICON_CAL),
          h('span', null, '详细记录')),
        total > 0 ? h('span', { className: 'dd-records-count' },
          '显示 ' + ((page - 1) * PAGE + 1) + '-' + Math.min(page * PAGE, total) + ' 条，共 ' + fmtIntl(total) + ' 条') : null)
      let body
      if (loading) {
        body = h('div', { className: 'dd-loading' }, '加载中...')
      } else if (rows.length === 0) {
        body = h('div', { className: 'empty' }, '暂无记录')
      } else {
        body = h('div', null,
          h('div', { className: 'dd-records-scroll' },
            h('table', null,
              h('colgroup', null,
                h('col', { style: { width: 100 } }),
                h('col', { style: { width: 150 } }),
                h('col', { style: { width: 120 } }),
                h('col', { style: { width: 56 } }),
                h('col', { style: { width: 64 } }),
                h('col', { style: { width: 64 } }),
                h('col', { style: { width: 64 } }),
                h('col', { style: { width: 88 } })),
              h('thead', null, h('tr', null,
                h('th', null, '时间'),
                h('th', null, '项目'),
                h('th', null, '模型'),
                h('th', null, '工具'),
                h('th', { className: 'num' }, '输入'),
                h('th', { className: 'num' }, '输出'),
                h('th', { className: 'num' }, '缓存'),
                h('th', { className: 'num' }, '费用'))),
              h('tbody', null, rows.map((r) => h('tr', { key: r.t + ':' + (r.model || '') + ':' + (r.project || '') },
                h('td', null, fmtBucket(r.t, gran)),
                h('td', null, h('span', { className: 'sess', title: r.project }, r.project || '-')),
                h('td', null, h('span', { className: 'sess', title: r.model }, r.model || '-')),
                h('td', null, 'dsh'),
                h('td', { className: 'num' }, fmtH9(r.input)),
                h('td', { className: 'num' }, fmtH9(r.output)),
                h('td', { className: 'num' }, fmtH9(r.cache)),
                h('td', { className: 'num' }, fmtCost(r.cost))))))),
          total > PAGE ? h('div', { className: 'dd-records-foot' },
            h('div', { className: 'pg' },
              h('button', { type: 'button', disabled: page <= 1, onClick: () => go(page - 1) }, '上一页'),
              h('span', { className: 'cur' }, page + '/' + pageCount),
              h('button', { type: 'button', disabled: page >= pageCount, onClick: () => go(page + 1) }, '下一页'))) : null)
      }
      return h('div', { className: 'dd-records' }, head, body)
    }

    // 视图状态持久化：任何重挂载（关闭/重开设置、插件重载、页面刷新）都恢复上次选择，
    // 不会自己跳回「今天」。localStorage 不可用时静默降级为默认值。
    const PREFS_KEY = 'dsh.usageDashboard.v1'

    function loadPrefs() {
      try {
        const raw = localStorage.getItem(PREFS_KEY)
        if (!raw) return {}
        const p = JSON.parse(raw)
        const out = {}
        if (p.range && RANGES.some((x) => x.key === p.range)) out.range = p.range
        if (p.custom && Number.isFinite(p.custom.from) && Number.isFinite(p.custom.to)) {
          out.custom = {
            fromStr: p.custom.fromStr || fmtDateMs(p.custom.from),
            from: p.custom.from,
            toStr: p.custom.toStr || fmtDateMs(p.custom.to),
            to: p.custom.to
          }
        }
        if (Array.isArray(p.modelSel) && p.modelSel.length) out.modelSel = p.modelSel
        if (typeof p.projectSel === 'string' && p.projectSel) out.projectSel = p.projectSel
        if (p.costMode === 'usd' || p.costMode === 'cny') out.costMode = p.costMode
        if (p.tokenMode === 'intl' || p.tokenMode === 'zh') out.tokenMode = p.tokenMode
        return out
      } catch (e) { return {} }
    }
    function savePrefs(p) {
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch (e) { /* ignore */ }
    }

    function Dashboard() {
      const [state, setState] = React.useState({ loading: true, error: false, data: null })
      const [refreshSeq, setRefreshSeq] = React.useState(0)
      const prefsRef = React.useRef(null)
      if (prefsRef.current === null) prefsRef.current = loadPrefs()
      const prefs = prefsRef.current
      const [range, setRange] = React.useState(prefs.range || 'today')
      const [custom, setCustom] = React.useState(prefs.custom || defaultCustom())
      const [modelSel, setModelSel] = React.useState(prefs.modelSel || null)
      const [projectSel, setProjectSel] = React.useState(prefs.projectSel || null)
      const [busy, setBusy] = React.useState(false)
      const [costMode, setCostMode] = React.useState(prefs.costMode || 'cny')
      const [tokenMode, setTokenMode] = React.useState(prefs.tokenMode || 'intl')
      const [anim, setAnim] = React.useState(false)
      const animTimer = React.useRef(0)
      const dataKeyRef = React.useRef(null)
      const loadSeq = React.useRef(0)
      const load = React.useCallback((silent) => {
        loadSeq.current += 1
        const seq = loadSeq.current
        if (!silent) setBusy(true)
        host.call('usage', { range: range, from: custom.from, to: custom.to, models: modelSel && modelSel.length ? modelSel : null, projects: projectSel ? [projectSel] : null }).then((r) => {
          if (seq !== loadSeq.current) return
          setState({ loading: false, error: !r || !!r.error, data: !r || r.error ? null : r })
           if (r && !r.error) setRefreshSeq((v) => v + 1)
          if (!silent) setBusy(false)
          // 筛选/范围变化时内容区做一次淡入过渡（同键的周期刷新不重复触发）
          const key = range + '|' + custom.from + '|' + custom.to + '|' + (modelSel || []).join(',') + '|' + (projectSel || '')
          if (dataKeyRef.current !== key) {
            dataKeyRef.current = key
            setAnim(true)
            clearTimeout(animTimer.current)
            animTimer.current = setTimeout(() => setAnim(false), 450)
          }
        }).catch(() => { if (seq !== loadSeq.current) return; setState({ loading: false, error: true, data: null }); if (!silent) setBusy(false) })
      }, [range, custom.from, custom.to, modelSel, projectSel])
      React.useEffect(() => {
        savePrefs({ range, custom, modelSel, projectSel, costMode, tokenMode })
      }, [range, custom, modelSel, projectSel, costMode, tokenMode])
      React.useEffect(() => {
        load(true)
        const off = setInterval(() => load(true), 30000)
        return () => { clearInterval(off) }
      }, [load])

      const secHead = h('div', { className: 'dd-sec-head' },
        h('h2', { className: 'dd-sec-heading' }, '数据看板'),
        h('p', { className: 'dd-sec-intro' }, '查看 DSH 会话的 Token 用量、费用与时长统计。'))
      if (state.loading) {
        return h('div', { className: 'dd-root' }, secHead, h('div', { className: 'dd-dash' }, h('div', { className: 'dd-loading' }, '加载中...')))
      }
      if (state.error || !state.data || !state.data.totals) {
        return h('div', { className: 'dd-root' }, secHead,
          h('div', { className: 'dd-dash' },
            h('div', { className: 'dd-empty' }, '数据加载失败', h('button', { type: 'button', onClick: () => load(false), style: { color: '#18181b', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 } }, '重试'))))
      }
      const t = state.data.totals
      const pct = t.pct || {}
      const meta = state.data.meta || { models: [], projects: [], vendors: {} }
      // 数字/英文字体统一：四个 Token 卡片共用同一个单位切换（intl/zh），不会出现「缓存千万、其他 M」混用
      const fmtTokens = (n) => tokenMode === 'zh' ? fmtZhTokens(n) : fmtH9(n)
      const fmtCostVal = (n) => costMode === 'cny' ? fmtCny(n) : fmtUsd(n)

      const durPopup = h(DurPopup, null)
      const pricingPopup = h(PricingPopup, { pricing: meta.pricing })

      const cards1 = [
        { title: '预估费用', color: 'dd-v-cost', tip: COST_TIP, popup: pricingPopup, popupWidth: 400, pct: pct.cost, onClick: () => setCostMode(costMode === 'cny' ? 'usd' : 'cny'), num: t.cost, fmt: fmtCostVal },
        { title: '总 Token', pct: pct.totalTokens, onClick: () => setTokenMode(tokenMode === 'intl' ? 'zh' : 'intl'), num: t.totalTokens, fmt: fmtTokens },
        { title: '输入 Token', pct: pct.inputTokens, num: t.inputTokens, fmt: fmtTokens },
        { title: '输出 Token', pct: pct.outputTokens, num: t.outputTokens, fmt: fmtTokens },
        { title: '缓存 Token', color: 'dd-v-cache', pct: pct.cacheTokens, onClick: () => setTokenMode(tokenMode === 'intl' ? 'zh' : 'intl'), num: t.cacheTokens, fmt: fmtTokens }
      ]
      const cards2 = [
        { title: '活跃时长', color: 'dd-v-dur', tip: DUR_TIP, popup: durPopup, popupWidth: 340, pct: pct.activeMs, num: t.activeMs / 1000, fmt: fmtDur },
        { title: '总时长', tip: TOTAL_TIP, popup: durPopup, popupWidth: 340, pct: pct.totalMs, num: t.totalMs / 1000, fmt: fmtDur },
        { title: '会话数', pct: pct.sessions, num: t.sessions, fmt: fmtIntl },
        { title: '总消息数', pct: pct.totalMessages, num: t.totalMessages, fmt: fmtIntl },
        { title: '用户消息数', pct: pct.userMessages, num: t.userMessages, fmt: fmtIntl }
      ]
      // 选择了模型后只保留费用/Token 5 项 KPI（时长与会话数隐藏）
      const modelFiltered = !!(modelSel && modelSel.length)
      const kpiCards = modelFiltered ? cards1 : cards1.concat(cards2)
      return h('div', { className: 'dd-root' },
        secHead,
        h('div', { className: 'dd-dash' },
          h(FilterBar, {
            range: range, setRange: setRange,
            custom: custom, setCustom: setCustom,
            modelSel: modelSel, setModelSel: setModelSel,
            projectSel: projectSel, setProjectSel: setProjectSel,
            meta: meta, busy: busy,
            onApply: (next) => { if (next) setCustom(next); else load(false) }
          }),
          h('div', { className: 'dd-anim' + (anim ? ' on' : '') },
            h('div', { className: 'dd-rows' }, kpiCards.map(renderCard)),
            h('div', { className: 'dd-charts' },
              h(TrendChart, { buckets: state.data.buckets || [], granularity: state.data.granularity || 'week' }),
              h(HeatChart, { heat: state.data.heat || null })),
            h('div', { className: 'dd-side-row' },
              h(RadarCard, { models: meta.models || [], modelSel: modelSel }),
              h(CacheTrendCard, {
                buckets: state.data.buckets || [], granularity: state.data.granularity || 'week',
                totals: t, models: meta.models || [], modelSel: modelSel,
                usd: costMode === 'usd',
                onPickModel: (id) => setModelSel(modelSel && modelSel.length === 1 && modelSel[0] === id ? null : [id])
              })),
            h('div', { className: 'dd-dist-row' },
              h(DistributionCard, { icon: ICON_MODEL, title: '模型分布', items: (meta.dist && meta.dist.models) || [] }),
              h(DistributionCard, { icon: ICON_PROJECT, title: '项目分布', items: (meta.dist && meta.dist.projects) || [] })),
            h('div', { className: 'dd-charts' },
              h(CalendarChart, { modelSel: modelSel, projectSel: projectSel, refreshSeq: refreshSeq })),
            h(RecordsCard, { range: range, custom: custom, modelSel: modelSel, projectSel: projectSel, costMode: costMode, refreshSeq: refreshSeq }))))
    }

    function renderCard(c) {
      return h(StatCard, {
        key: c.title,
        title: c.title,
        color: c.color,
        tip: c.tip,
        popup: c.popup,
        popupWidth: c.popupWidth,
        pct: c.pct,
        onClick: c.onClick,
        num: c.num,
        fmt: c.fmt
      })
    }

    slots.inject('settings.section', () => slots.register(
      { name: 'settings.section', id: 'dashboard', order: 30, label: () => '数据看板' },
      () => h(Dashboard, null)
    ))

  }
}
    return module.exports;
  }
});
