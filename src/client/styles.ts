/** Theme-native styling for Side Chat without global DSH element overrides. */
export const sideChatStyles = `
.sc-icon-button {
  width: calc(28px + var(--dsh-content-font-delta, 0px));
  height: calc(28px + var(--dsh-content-font-delta, 0px));
  padding: 6px; border: 0; border-radius: var(--dsw-radius-sm);
  background: transparent; color: var(--dsw-alias-label-tertiary);
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; vertical-align: middle;
}
.sc-icon-button svg { width: 16px; height: 16px; }
.sc-icon-button:hover { color: var(--dsw-alias-label-secondary); background: var(--dsw-alias-interactive-bg-hover); }
.sc-icon-button:focus-visible, .sc-selection-action:focus-visible { outline: 2px solid var(--dsw-focus-ring-color); outline-offset: 2px; }
.sc-selection-capsule {
  display: inline-flex !important; align-items: stretch; overflow: hidden;
  border-radius: 999px; background: var(--dsw-alias-button-floating-fill);
  box-shadow: var(--dsw-elevation-panel);
}
.sc-selection-capsule > button:not([data-side-chat-selection-button]) {
  box-shadow: none !important;
  border-radius: 999px 0 0 999px !important;
  background: transparent !important;
}
.sc-selection-action {
  appearance: none; padding: 5px 12px; cursor: pointer;
  font: var(--dsw-font-xs-13); color: var(--dsw-alias-label-primary);
  border: 0; border-left: 1px solid var(--dsw-alias-border-l3);
  border-radius: 0 999px 999px 0;
  background: transparent;
}
.sc-selection-action:hover, .sc-selection-action:focus-visible {
  background: var(--dsw-alias-button-floating-hover);
}
.sc-root {
  --sc-muted: var(--dsw-alias-label-caption);
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1);
  font: var(--dsw-font-sm-14); height: 100%; min-height: 0;
  display: flex; flex-direction: column; overflow: hidden;
}
.sc-root button, .sc-root textarea, .sc-root input, .sc-root select,
.sc-rail button, .sc-rail input, .sc-anchor-markers button {
  font: inherit; color: inherit;
}
.sc-muted { color: var(--dsw-alias-label-caption); font: var(--dsw-font-xs-13); }
.sc-header {
  display: flex; align-items: center; gap: 8px;
  padding: 12px 16px; border-bottom: 1px solid var(--dsw-alias-border-l2);
  flex-shrink: 0;
}
.sc-heading { font: var(--dsw-font-sm-strong-14); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc-padded { padding: 16px; }
.sc-scroll { overflow: auto; overscroll-behavior: contain; flex: 1; min-height: 0; }
.sc-toolbar { display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
.sc-toolbar > [data-state] { display: inline-flex; }
.sc-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 7px;
  padding: 7px 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: transparent; color: var(--dsw-alias-label-primary);
  cursor: pointer; border-radius: var(--dsw-radius-md); font: var(--dsw-font-xs-13);
}
.sc-btn:hover { background: var(--dsw-alias-interactive-bg-hover); }
.sc-btn:disabled { opacity: .4; cursor: default; }
.sc-btn-primary { background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-1); border-color: transparent; }
.sc-btn-primary:hover { opacity: .85; background: var(--dsw-alias-label-primary); }
.sc-field {
  width: 100%; box-sizing: border-box;
  padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary);
  border-radius: var(--dsw-radius-md); outline: none;
}
.sc-field:focus { border-color: var(--dsw-alias-label-secondary); box-shadow: 0 0 0 2px var(--dsw-alias-interactive-bg-hover); }
.sc-textarea { resize: vertical; min-height: 78px; line-height: 1.55; }
.sc-item {
  width: 100%; text-align: left; display: block; padding: 12px 13px;
  background: transparent; border: 1px solid transparent; border-radius: var(--dsw-radius-lg);
  cursor: pointer;
}
.sc-item:hover, .sc-item[data-active='true'] { background: var(--dsw-alias-interactive-bg-hover); }
.sc-item[data-active='true'] { border-color: var(--dsw-alias-border-l2); }
.sc-item-title { font: var(--dsw-font-xs-strong-13); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-item-excerpt { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; color: var(--dsw-alias-label-secondary); font: var(--dsw-font-xs-13); margin-top: 4px; }
.sc-item-preview { color: var(--dsw-alias-label-caption); font: var(--dsw-font-xs-13); white-space: nowrap; text-overflow: ellipsis; overflow: hidden; margin-top: 3px; }
.sc-quote {
  margin: 0; padding: 10px 12px; border: 0; border-left: 2px solid var(--dsw-alias-border-l4);
  background: var(--dsw-alias-bg-layer-2); border-radius: var(--dsw-radius-md);
  color: var(--dsw-alias-label-secondary); font: var(--dsw-font-xs-13);
  white-space: pre-wrap; overflow-wrap: anywhere; max-height: 112px; overflow: auto;
}
.sc-composer { padding: 12px; border-top: 1px solid var(--dsw-alias-border-l2); flex: none; display: grid; gap: 8px; }
.sc-msg-list { padding: 12px 16px 18px; display: flex; flex-direction: column; gap: 16px; }
.sc-msg { font: var(--dsw-font-sm-14); line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.sc-msg-user { align-self: flex-end; padding: 10px 13px; border-radius: var(--dsw-radius-lg); background: var(--dsw-alias-bg-layer-2); max-width: 88%; }
.sc-msg-assistant { align-self: stretch; max-width: 100%; }
.sc-msg-actions { display: flex; justify-content: flex-end; gap: 3px; margin-top: 8px; }
.sc-message-header { padding: 10px 16px; border-bottom: 1px solid var(--dsw-alias-border-l2); display: grid; gap: 6px; }
.sc-status { color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-xs-13); }
.sc-empty { padding: 28px 20px; text-align: center; color: var(--dsw-alias-label-caption); font: var(--dsw-font-xs-13); }
.sc-alert { padding: 10px 14px; font: var(--dsw-font-xs-13); color: var(--dsw-alias-state-danger-primary, #b42318); }
.sc-divider { height: 1px; background: var(--dsw-alias-border-l2); border: 0; margin: 10px 0; }
.sc-section-label { color: var(--dsw-alias-label-tertiary); font: var(--dsw-font-xxs-12); font-weight: 600; margin: 0 0 8px; }
.sc-rail { position: fixed; z-index: 17; pointer-events: auto; display: flex; align-items: center; }
.sc-rail-column {
  display: flex; flex-direction: column; gap: 4px; align-items: center;
  max-height: min(420px, calc(100dvh - 180px)); overflow-y: auto; overflow-x: hidden; scrollbar-width: none;
  width: 28px; padding: 6px 0; border-radius: var(--dsw-radius-md);
}
.sc-rail-column::-webkit-scrollbar { display:none; }
.sc-rail-trigger { width: 26px; height: 26px; display: flex; align-items:center; justify-content:center; border:0; background:transparent; color:var(--dsw-alias-label-tertiary); cursor:pointer; border-radius:var(--dsw-radius-sm); }
.sc-rail-trigger svg { width: 16px; height: 16px; }
.sc-rail-trigger:hover { background:var(--dsw-alias-interactive-bg-hover); color:var(--dsw-alias-label-primary); }
.sc-rail-dot { width: 6px; height: 6px; border: 0; border-radius: 50%; background: var(--dsw-alias-label-secondary); padding:0; cursor:pointer; opacity: .8; transition:transform 130ms ease,opacity 130ms ease; }
.sc-rail-dot:hover, .sc-rail-dot[data-active='true'] { transform:scale(1.55); background:var(--dsw-alias-label-primary); opacity:1; }
.sc-rail-popover {
  position: absolute; left: 100%; top: 0; margin-left: 9px;
  width: min(330px, calc(100vw - 96px)); max-height: min(440px, calc(100dvh - 100px));
  display: flex; flex-direction: column; overflow: hidden;
  background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg); box-shadow: var(--dsw-elevation-panel); animation: sc-enter 110ms ease-out;
}
.sc-rail-popover::before { content: ''; position: absolute; left: -12px; top: 0; bottom: 0; width: 12px; }
.sc-rail-results { flex:1; min-height:0; overflow:auto; padding:4px 8px 10px; }
.sc-rail-top { padding:12px 12px 6px; }
.sc-anchor-markers { position: fixed; inset: 0; pointer-events:none; z-index:15; }
.sc-anchor-button {
  position:absolute; pointer-events:auto; width:22px; height:22px;
  border:0; border-radius:50%; background:var(--dsw-alias-bg-layer-1);
  box-shadow: var(--dsw-elevation-panel); color:var(--dsw-alias-label-tertiary);
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;
}
.sc-anchor-button:hover { color: var(--dsw-alias-label-primary); background:var(--dsw-alias-interactive-bg-hover); }
.sc-anchor-button svg {width:13px;height:13px;}
.sc-jump-full { animation: sc-jump-outline 750ms ease-out 3; border-radius: 6px; }
.sc-jump-range { position:fixed; pointer-events:none; z-index:19; border-radius:3px; background:rgba(234,184,58,.26); animation:sc-jump-highlight 750ms ease-out 3; }
@keyframes sc-enter {from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
@keyframes sc-jump-outline { 0%,100% { outline: 3px solid transparent; } 45% { outline:3px solid var(--dsw-alias-state-business-primary); outline-offset:5px; } }
@keyframes sc-jump-highlight { 0%,100% { opacity:.15 } 40% { opacity:1 } }
@media (max-width: 920px) {
 .sc-rail { display: none; }
 .sc-anchor-button { width: 20px; height: 20px; }
}
@media (prefers-reduced-motion:reduce) {
 .sc-rail-dot, .sc-rail-popover,.sc-jump-full,.sc-jump-range {animation:none!important;transition:none!important;}
 .sc-jump-full {outline:2px solid var(--dsw-alias-state-business-primary);}
}
`
