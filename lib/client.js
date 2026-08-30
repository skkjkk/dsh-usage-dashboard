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
const CSS = '.dd-bar-inner{position:relative;}.dd-seg-overlay{position:absolute;left:0;right:0;bottom:0;}.dd-root{min-height:100%;}.dd-dash{background:#f3f4f6;min-height:100%;padding:16px;box-sizing:border-box;font-family:"Century Gothic","Microsoft YaHei UI","PingFang SC","Microsoft YaHei",sans-serif;color:#09090b;}.dd-dash button{font-family:inherit;}.dd-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;}.dd-range{display:flex;align-items:center;border-radius:999px;background:#e2e3e7;padding:2px;gap:1px;flex-wrap:wrap;}.dd-pill{display:flex;align-items:center;height:24px;border-radius:999px;padding:0 9px;font-size:12px;border:none;cursor:pointer;background:transparent;color:#52525b;transition:background .12s ease,color .12s ease;}.dd-pill:hover{color:#09090b;}.dd-pill.on{background:#18181b;color:#fff;font-weight:600;}.dd-custom{display:flex;align-items:center;gap:8px;border-radius:6px;border:1px solid #d4d4d8;background:#fff;padding:6px 10px;flex-wrap:wrap;}.dd-custom input{background:#fff;border:1px solid #d4d4d8;border-radius:4px;color:#18181b;font-size:12px;padding:2px 6px;font-family:inherit;color-scheme:light;}.dd-custom input:focus{border-color:#18181b;outline:none;}.dd-custom .sep{font-size:12px;color:#a1a1aa;}.dd-custom .apply{display:flex;align-items:center;height:24px;border-radius:999px;background:#18181b;color:#fff;padding:0 10px;font-size:12px;font-weight:600;border:none;cursor:pointer;}.dd-custom .apply:hover{background:#27272a;}.dd-spacer{flex:1;}.dd-filter-row{display:flex;align-items:center;gap:8px;min-height:28px;flex-wrap:wrap;}.dd-drop{position:relative;}.dd-drop-btn{display:flex;align-items:center;gap:6px;min-height:28px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;padding:0 9px;font-size:12px;cursor:pointer;font-family:inherit;color:#52525b;transition:background .12s ease,border-color .12s ease,color .12s ease;}.dd-drop-btn:hover{color:#18181b;border-color:#a1a1aa;}.dd-drop-btn.open{color:#09090b;border-color:#18181b;}.dd-drop-icon{display:inline-flex;color:#71717a;flex:none;}.dd-drop-btn.open .dd-drop-icon{color:#09090b;}.dd-drop-label{font-weight:500;flex:none;color:inherit;}.dd-drop-value{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#a1a1aa;}.dd-drop-btn.open .dd-drop-value{color:#52525b;}.dd-drop-arrow{display:inline-flex;color:#a1a1aa;flex:none;transition:transform .15s ease;}.dd-drop-btn.open .dd-drop-arrow{transform:rotate(180deg);}.dd-drop-menu{position:absolute;top:34px;left:0;z-index:50;min-width:220px;max-height:260px;overflow-y:auto;background:#fff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 10px 15px -3px rgba(0,0,0,.08);padding:4px 0;scrollbar-width:none;}.dd-drop-menu::-webkit-scrollbar{display:none;}.dd-drop-item{display:flex;align-items:center;gap:7px;width:100%;text-align:left;border:none;background:none;height:28px;padding:0 10px;font-size:12px;color:#52525b;cursor:pointer;font-family:inherit;white-space:nowrap;}.dd-drop-item:hover{background:#f3f4f6;color:#18181b;}.dd-drop-item.on{background:#f3f4f6;color:#18181b;}.dd-check{display:flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:4px;flex:none;background:transparent;border:1px solid #d4d4d8;color:#18181b;}.dd-drop-item.on .dd-check{background:#18181b;border:none;color:#fff;}.dd-drop-item .label{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.dd-drop-item .sub{color:#a1a1aa;font-size:11px;flex:none;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;}.dd-clear{background:none;border:none;color:#dc2626;font-size:12px;font-weight:500;cursor:pointer;padding:0 6px;height:28px;}.dd-clear:hover{text-decoration:underline;}.dd-busy{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:#52525b;}.dd-busy .spinner{width:12px;height:12px;border:1.5px solid #e2e3e7;border-top-color:#18181b;border-radius:50%;animation:ddspin .7s linear infinite;}.dd-rows{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;}@media (min-width:768px){.dd-rows{grid-template-columns:repeat(5,1fr);gap:12px;}}.dd-kpi{min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:20px;text-align:left;position:relative;overflow:hidden;transition:border-color .12s ease,background .12s ease;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-kpi.clickable{cursor:pointer;}.dd-kpi.clickable:hover{border-color:#d4d4d8;}.dd-kpi.clickable:active{background:#fafafa;}.dd-kpi-label{display:flex;align-items:center;justify-content:space-between;font-size:13px;line-height:1.3;color:#52525b;margin-bottom:4px;min-height:19px;}.dd-kpi-label .lt{display:flex;align-items:center;gap:4px;min-width:0;overflow:hidden;white-space:nowrap;flex:1 1 auto;}.dd-kpi-label .pct{font-size:11px;white-space:nowrap;flex:none;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;margin-left:4px;}.dd-pct-up{color:#71717a;}.dd-pct-down{color:#a1a1aa;}.dd-pct-flat{color:#a1a1aa;}.dd-info-wrap{position:relative;display:inline-flex;flex:none;}.dd-info{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:999px;border:1px solid #d4d4d8;color:#52525b;cursor:pointer;flex:none;background:#fff;padding:0;transition:border-color .12s ease,color .12s ease;}.dd-info:hover{border-color:#a1a1aa;color:#18181b;}.dd-info svg{display:block;}.dd-kpi-value{margin-top:0;height:30px;overflow:hidden;white-space:nowrap;font-size:24px;font-weight:700;line-height:30px;font-variant-numeric:tabular-nums;color:#09090b;}.dd-v-cost{color:#34d399;}.dd-v-dur{color:#60a5fa;}.dd-v-cache{color:#71717a;}.dd-pop{position:fixed;z-index:200;background:#fff;border:1px solid #e4e4e7;border-radius:8px;box-shadow:0 20px 25px -5px rgba(0,0,0,.15);padding:14px 16px;box-sizing:border-box;max-width:calc(100vw - 16px);white-space:normal;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-pop .pop-title{font-size:13px;font-weight:700;color:#09090b;margin-bottom:8px;}.dd-pop .pop-body{font-size:12px;line-height:1.7;color:#52525b;overflow-wrap:break-word;word-break:break-word;}.dd-pop .pop-sec{margin-top:10px;}.dd-pop .pop-sec .sec-title{font-size:12px;font-weight:700;color:#09090b;margin-bottom:4px;}.dd-pop table{border-collapse:collapse;width:100%;margin-top:8px;table-layout:fixed;}.dd-pop th{font-size:10px;color:#a1a1aa;font-weight:500;text-align:left;padding:2px 6px 4px 0;border-bottom:1px solid #e4e4e7;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;overflow-wrap:break-word;word-break:break-all;}.dd-pop td{font-size:11px;color:#52525b;padding:4px 6px 4px 0;border-bottom:1px solid #f3f4f6;font-family:"JetBrains Mono","SF Mono",Consolas,monospace;white-space:normal;overflow-wrap:break-word;word-break:break-all;}.dd-pop td.mdl{overflow:hidden;text-overflow:ellipsis;}.dd-pop td.unmatched{color:#a1a1aa;}.dd-charts{display:flex;flex-direction:column;gap:24px;}.dd-chart{min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-chart-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:24px;}.dd-chart-title{display:flex;align-items:center;gap:6px;min-width:0;font-size:15px;font-weight:500;color:#52525b;white-space:nowrap;overflow:hidden;}.dd-chart-title .icon{display:inline-flex;color:#71717a;flex:none;}.dd-chart-tools{display:flex;align-items:center;gap:12px;flex:none;flex-wrap:wrap;}.dd-legend{display:flex;align-items:center;gap:12px;font-size:14px;color:#71717a;}.dd-legend-btn{display:flex;align-items:center;gap:6px;border:none;background:none;padding:0;cursor:pointer;font-size:14px;color:inherit;font-family:inherit;transition:opacity .12s ease;}.dd-legend-btn.off{opacity:.3;}.dd-swatch{display:inline-block;width:13px;height:13px;border-radius:4px;flex:none;}.dd-seg-group{display:inline-flex;align-items:center;gap:2px;border-radius:999px;background:#e2e3e7;padding:4px;}.dd-seg-btn{display:flex;align-items:center;justify-content:center;gap:6px;padding:3px 14px;border-radius:999px;font-size:14px;border:none;cursor:pointer;background:transparent;color:#52525b;transition:background .12s ease,color .12s ease;white-space:nowrap;}.dd-seg-btn:hover{color:#09090b;}.dd-seg-btn.on{background:#18181b;color:#fff;}.dd-plot-row{display:flex;width:100%;}.dd-y{display:flex;flex-direction:column;justify-content:space-between;width:58px;flex:0 0 58px;box-sizing:border-box;padding-right:8px;text-align:right;font-size:12px;white-space:nowrap;overflow:visible;color:#a1a1aa;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-y span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.dd-plot{position:relative;display:flex;align-items:flex-end;flex:1;min-width:0;height:220px;gap:1px;}.dd-col{position:relative;display:flex;flex-direction:column;justify-content:flex-end;flex:1 1 0;min-width:0;height:100%;cursor:pointer;}.dd-col.dim .dd-seg{opacity:.35;}.dd-bar-inner{width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;}.dd-seg{width:100%;transition:height .3s ease,opacity .3s ease,background-color .3s ease;}.dd-tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:40;display:none;flex-direction:column;gap:3px;white-space:nowrap;border-radius:4px;background:#e2e3e7;border:1px solid #d4d4d8;box-shadow:0 20px 25px -5px rgba(0,0,0,.12);padding:8px 10px;font-size:14px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-col:hover .dd-tip{display:flex;}.dd-tip .tt-title{font-weight:700;margin-bottom:2px;color:#52525b;}.dd-tip .tt-row{color:#71717a;}.dd-tip .tt-cost{color:#34d399;}.dd-tip .tt-dur{color:#60a5fa;}.dd-tip .tt-dur2{color:#93c5fd;}.dd-x{display:flex;margin-left:58px;margin-top:8px;}.dd-x .labels{display:flex;flex:1;min-width:0;height:20px;position:relative;}.dd-x .labels .cell{flex:1;min-width:0;text-align:center;}.dd-x .labels .cell.abs{position:absolute;top:0;text-align:center;}.dd-x .labels .cell.abs span{transform:translateX(-50%);}.dd-x .labels .cell.abs.first{text-align:left;}.dd-x .labels .cell.abs.first span{transform:none;}.dd-x .labels .cell.abs.last{text-align:right;}.dd-x .labels .cell.abs.last span{transform:translateX(-100%);}.dd-x .labels span{display:inline-block;white-space:nowrap;font-size:14px;color:#71717a;}.dd-heat{display:flex;flex-direction:column;gap:12px;}.dd-heat-row{display:flex;align-items:center;gap:8px;}.dd-heat-day{width:40px;flex:none;font-size:13px;color:#71717a;text-align:left;}.dd-heat-cells{display:flex;flex:1;gap:6px;min-width:0;}.dd-heat-cell{position:relative;flex:1;aspect-ratio:1;min-width:0;}.dd-heat-cell .inner{width:100%;height:100%;border-radius:4px;transition:background-color .5s ease-out;}.dd-heat-cell .tip{position:absolute;bottom:calc(100% + 8px);left:50%;transform:translateX(-50%);z-index:40;display:none;flex-direction:column;gap:3px;white-space:normal;max-width:calc(100vw - 24px);box-sizing:border-box;border-radius:4px;background:#e2e3e7;border:1px solid #d4d4d8;box-shadow:0 20px 25px -5px rgba(0,0,0,.12);padding:8px 10px;font-size:14px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-heat-cell:hover .tip{display:flex;}.dd-heat-cell.edge-left .tip{left:0;transform:none;}.dd-heat-cell.edge-right .tip{left:100%;transform:translateX(-100%);}.dd-heat-cell .tip .tt-title{font-weight:700;margin-bottom:2px;color:#52525b;}.dd-heat-cell .tip .tt-token{color:#71717a;}.dd-heat-cell .tip .tt-cost{color:#34d399;}.dd-heat-cell .tip .tt-dur{color:#60a5fa;}.dd-heat-x{display:flex;margin-left:48px;margin-top:12px;}.dd-heat-x .labels{display:flex;flex:1;min-width:0;}.dd-heat-x .labels .cell{flex:1;text-align:center;}.dd-heat-x .labels span{font-size:14px;color:#71717a;}.dd-heat-legend{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:16px;}.dd-heat-legend .lbl{font-size:13px;color:#a1a1aa;line-height:1;}.dd-heat-legend .dots{display:flex;align-items:center;gap:4px;}.dd-dot{width:12px;height:12px;border-radius:4px;}.dd-cal{display:flex;flex-direction:column;gap:12px;width:100%;overflow:visible;}.dd-cal-body{display:flex;gap:8px;align-items:flex-start;overflow:visible;}.dd-cal-days{display:none;}.dd-cal-days span{font-size:10px;color:#a1a1aa;line-height:1;flex:1;display:flex;align-items:center;}.dd-cal-cols{display:grid;grid-template-columns:repeat(40,minmax(0,1fr));gap:6px;flex:1;min-width:0;align-items:start;}.dd-cal-col{display:flex;flex-direction:column;gap:6px;min-width:0;align-self:start;}.dd-cal-cell{position:relative;flex:0 0 auto;width:100%;aspect-ratio:1 / 1;min-width:0;border-radius:5px;}.dd-cal-floating-tip{position:fixed;z-index:1000;display:flex;flex-direction:column;gap:3px;transform:translate(-50%,-100%);pointer-events:none;white-space:normal;max-width:calc(100vw - 24px);box-sizing:border-box;border-radius:4px;background:#e2e3e7;border:1px solid #d4d4d8;box-shadow:0 20px 25px -5px rgba(0,0,0,.12);padding:6px 9px;font-size:12px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-cal-floating-tip.below{transform:translate(-50%,0);}.dd-cal-floating-tip .tt-token{color:#71717a;}.dd-cal-legend{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:10px;}.dd-cal-legend .lbl{font-size:11px;color:#a1a1aa;line-height:1;}.dd-cal-legend .dots{display:flex;gap:3px;}.dd-cal-dot{width:11px;height:11px;border-radius:3px;}.dd-records{margin-top:16px;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-records-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:16px;}.dd-records-title{display:flex;align-items:center;gap:6px;font-size:15px;font-weight:500;color:#52525b;white-space:nowrap;overflow:hidden;}.dd-records-title .icon{display:inline-flex;color:#71717a;flex:none;}.dd-records-count{font-size:12px;color:#a1a1aa;flex:none;}.dd-records-scroll{overflow-x:auto;max-height:420px;overflow-y:auto;border-bottom:1px solid #f3f4f6;}.dd-records table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:820px;}.dd-records th{font-size:11px;color:#a1a1aa;font-weight:500;text-align:left;padding:6px 10px;border-bottom:1px solid #e4e4e7;white-space:nowrap;}.dd-records th.num{text-align:right;}.dd-records td{font-size:12px;color:#52525b;padding:6px 10px;border-bottom:1px solid #f3f4f6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-variant-numeric:tabular-nums;}.dd-records td.num{text-align:right;}.dd-records td .sess{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-records tbody tr:hover td{background:#fafafa;}.dd-records .more{display:flex;align-items:center;justify-content:center;margin-top:12px;}.dd-records .more button{display:flex;align-items:center;height:28px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;padding:0 14px;font-size:12px;color:#52525b;cursor:pointer;font-family:inherit;transition:color .12s ease,border-color .12s ease;}.dd-records .more button:hover{color:#18181b;border-color:#a1a1aa;}.dd-records .more button:disabled{opacity:.5;cursor:default;}.dd-records .empty{padding:32px 0;text-align:center;color:#a1a1aa;font-size:13px;}.dd-dist-row{display:flex;flex-direction:column;gap:24px;margin-top:24px;margin-bottom:24px;}.dd-dist{flex:none;min-width:0;border-radius:8px;border:1px solid #e4e4e7;background:#fff;padding:20px 24px;font-family:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New","PingFang SC","Microsoft YaHei",monospace;}.dd-dist-body{display:flex;align-items:center;gap:24px;}.dd-dist-donut{position:relative;flex:none;width:120px;height:120px;}.dd-dist-donut svg{display:block;}.dd-dist-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}.dd-dist-center .v{font-size:15px;font-weight:700;color:#18181b;white-space:nowrap;font-variant-numeric:tabular-nums;}.dd-dist-center .l{font-size:10px;color:#a1a1aa;}.dd-dist-legend{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}.dd-dist-item{display:flex;align-items:center;gap:8px;min-width:0;}.dd-dist-item .dot{width:10px;height:10px;border-radius:50%;flex:none;align-self:center;position:relative;top:-1px;}.dd-dist-item .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:#52525b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-dist-item .val{font-size:12px;color:#18181b;flex:none;font-variant-numeric:tabular-nums;}.dd-dist-item .pct{font-size:14px;line-height:20px;color:#a1a1aa;flex:none;width:56px;text-align:right;font-variant-numeric:tabular-nums;position:relative;top:-1px;}.dd-empty{padding:64px 0;text-align:center;color:#71717a;font-size:14px;}.dd-loading{padding:64px 0;text-align:center;color:#71717a;font-size:14px;animation:ddpulse 2s cubic-bezier(.4,0,.6,1) infinite;}@keyframes ddpulse{50%{opacity:.5;}}@keyframes ddspin{to{transform:rotate(360deg);}}[role="dialog"]:has([data-slot="settings.header"]){width:1320px!important;max-width:calc(100vw - 32px)!important;}[role="dialog"] nav > div:nth-of-type(2) > button:nth-child(5) > svg{display:none;}[role="dialog"] nav > div:nth-of-type(2) > button:nth-child(5)::before{content:"";display:block;width:16px;height:16px;flex:none;background-image:linear-gradient(#71717a,#71717a),linear-gradient(#71717a,#71717a),linear-gradient(#71717a,#71717a);background-size:3px 7px,3px 11px,3px 9px;background-position:2px 9px,6.5px 5px,11px 7px;background-repeat:no-repeat;}.dd-title{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:700;color:#09090b;margin-bottom:14px;}.dd-title .icon{display:inline-flex;color:#3f3f46;}.dd-dist-item{padding:4px 8px;min-height:30px;box-sizing:border-box;border-radius:6px;transition:opacity .15s ease;}.dd-dist-item.dim{opacity:.22;}.dd-dist-item .name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:15px;font-weight:600;line-height:20px;color:#18181b;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;position:relative;top:-1px;}.dd-dist-item .val{font-size:14px;font-weight:600;line-height:20px;color:#18181b;flex:none;font-variant-numeric:tabular-nums;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;position:relative;top:-1px;}.dd-dist-item .pct{font-size:14px;line-height:20px;color:#a1a1aa;flex:none;width:56px;text-align:right;font-variant-numeric:tabular-nums;position:relative;top:-1px;}.dd-dist-center .v{font-size:18px;font-weight:700;color:#18181b;white-space:nowrap;font-variant-numeric:tabular-nums;}.dd-records{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"PingFang SC","Microsoft YaHei",sans-serif;}.dd-records table td,.dd-records table th{font-variant-numeric:tabular-nums;}.dd-records-foot{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:12px;}.dd-records-foot .info{font-size:12px;color:#71717a;font-variant-numeric:tabular-nums;}.dd-records-foot .pg{display:inline-flex;align-items:center;gap:6px;}.dd-records-foot .pg button{display:inline-flex;align-items:center;height:24px;border-radius:999px;border:1px solid #d4d4d8;background:#fff;color:#18181b;font-size:12px;padding:0 10px;cursor:pointer;font-family:inherit;}.dd-records-foot .pg button:disabled{opacity:.4;cursor:default;}.dd-records-foot .pg .cur{font-size:12px;color:#52525b;font-variant-numeric:tabular-nums;}.dd-sec-head{margin-bottom:16px;}.dd-sec-heading{font-size:20px;font-weight:700;color:#09090b;margin:0 0 4px;line-height:1.3;}.dd-sec-intro{margin:0;font-size:13px;color:#71717a;line-height:1.5;}.dd-anim.on{animation:ddFade .35s ease;}@keyframes ddFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}.dd-drop-count{color:#71717a;font-size:12px;font-variant-numeric:tabular-nums;}.dd-model-menu{position:absolute;right:0;top:calc(100% + 4px);width:300px;max-height:min(420px,70vh);display:flex;flex-direction:column;background:#fff;border:1px solid #e4e4e7;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.08);z-index:50;overflow:hidden;}.dd-model-actions{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #f0f0f2;flex:none;}.dd-model-actions .link{background:none;border:none;color:#18181b;font-size:12px;cursor:pointer;padding:2px 6px;font-family:inherit;border-radius:6px;}.dd-model-actions .link:hover{background:#f4f4f5;}.dd-model-actions .spacer{flex:1;}.dd-model-actions .cnt{font-size:12px;color:#a1a1aa;font-variant-numeric:tabular-nums;}.dd-model-scroll{overflow-y:auto;padding:4px 6px 8px;}.dd-series{margin-top:2px;}.dd-series-head{display:flex;align-items:center;gap:6px;width:100%;background:none;border:none;padding:6px;cursor:pointer;border-radius:6px;font-family:inherit;text-align:left;}.dd-series-head:hover{background:#f4f4f5;}.dd-series-head .chev{display:inline-flex;transition:transform .15s ease;color:#71717a;flex:none;}.dd-series-head .chev.open{transform:rotate(180deg);}.dd-series-head .name{flex:1;font-size:13px;font-weight:600;color:#18181b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.dd-series-head .cnt{font-size:12px;color:#a1a1aa;font-variant-numeric:tabular-nums;}.dd-series-body{display:flex;flex-direction:column;gap:2px;padding:2px 0 4px 18px;}.dd-model-item{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:6px;cursor:pointer;font-size:12px;color:#52525b;min-width:0;}.dd-model-item:hover{background:#f4f4f5;}.dd-model-item .lbl{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}.dd-model-item input{accent-color:#18181b;margin:0;flex:none;'

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
    const COST_TIP = '费用按 vibe-usage-model-pricing.csv 定价表估算（$ × 7 → ¥/百万 tokens），覆盖 204 个模型；DeepSeek V4 自 2026-08-17 起按峰谷计费（工作日高峰 9:00-12:00、14:00-18:00，北京时间，周末及其余时段为空闲（高峰一半））；未匹配模型暂不计费。点击卡片切换 ¥/＄。'
    const DUR_TIP = '会话时长说明：活跃时长 = 所有 turn 的累计时长（AI 实际生成内容时间，不含排队与首 Token 延迟）；并行会话的生成时间会分别累加，因此可能超过 24H。总时长 = 各会话首条到末条消息的时间跨度，重叠（并行）会话只计一次后相加（含思考、看代码等空闲）。'
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
      const observer = new MutationObserver(patch)
      observer.observe(document.body, { childList: true, subtree: true })
      return () => {
        observer.disconnect()
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
            h('button', { type: 'button', className: 'link', onClick: () => props.onSelect(models.map((m) => m.id)) }, '全选'),
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
            h('div', null, '从 AI 开始输出到回复完毕算一个 turn，活跃时长 = 所有 turn 的累计时长。不包含排队等待和首 Token 延迟（TTFT），只计算 AI 实际生成内容的时间。两次 prompt 之间的空闲不计入；并行会话分别累加，所以活跃时长可能超过 24H。')),
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
          hasDs ? h('div', { className: 'pop-sec', style: { marginTop: 6 } }, 'DeepSeek V4 自 2026-08-17 起按峰谷计费：高峰 9:00-12:00、14:00-18:00（北京时间），空闲为高峰一半；表中 ¥a~b/M 为空闲~高峰。') : null),
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
      const labelCount = gran === 'hour' ? 8 : 7
      const labelIdx = n <= labelCount ? null : Array.from({ length: labelCount }, (_, k) => Math.round(k * (n - 1) / (labelCount - 1)))

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
        let segArr
        let segsEl
        if (isDur) {
          // 总时长是背景，活跃时长是其子集，使用底部叠覆而不是相加堆叠。
          const totalH = durSegs.total ? w.totalMs / M : 0
          const activeH = durSegs.active ? (w.activeMs != null ? w.activeMs : w.durMs) / M : 0
          const mkDur = (height, bg, key) => h('div', {
            key,
            className: 'dd-seg' + (key === 'active' ? ' dd-seg-overlay' : ''),
            style: {
              height: Math.max(0, height * 100) + '%',
              backgroundColor: bg,
              borderRadius: height > 0 ? Math.min(4, height * 220 / 2) + 'px ' + Math.min(4, height * 220 / 2) + 'px 0 0' : '0'
            }
          })
          segsEl = h('div', { className: 'dd-bar-inner' },
            durSegs.total ? mkDur(totalH, TREND_SEG_COLORS.durTotal, 'total') : null,
            durSegs.active ? mkDur(activeH, TREND_SEG_COLORS.durActive, 'active') : null)
        } else {
          if (isCost) {
            segArr = [{ h: (w.costIn + w.costOut + w.costCache) / M, bg: TREND_SEG_COLORS.cost }]
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
              key: j,
              className: 'dd-seg',
              style: {
                height: Math.max(0, s.h * 100) + '%',
                backgroundColor: s.bg,
                borderRadius: j === topIdx ? rad + 'px ' + rad + 'px 0 0' : '0'
              }
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
          labelIdx ? labelIdx.map((idx, k) => {
            const first = k === 0
            const last = k === labelCount - 1
            return h('div', {
              key: idx,
              className: 'cell abs' + (first ? ' first' : last ? ' last' : ''),
              style: { left: (k * 100 / (labelCount - 1)) + '%' }
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
