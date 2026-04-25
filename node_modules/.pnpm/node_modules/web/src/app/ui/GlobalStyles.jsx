import React from "react";

export function FontLink() {
  React.useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Kanit:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,300;1,400;1,600;1,700&family=DM+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
    return () => {
      try {
        document.head.removeChild(link);
      } catch (_) {}
    };
  }, []);

  const css = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; font-size: 16px; }
    body { background: #F0F6FF; -webkit-font-smoothing: antialiased; }

    :root {
      --sp1: 4px;  --sp2: 8px;   --sp3: 12px;  --sp4: 16px;
      --sp5: 20px; --sp6: 24px;  --sp8: 32px;  --sp10: 40px;
      --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 24px;
      --shadow-sm: 0 1px 3px rgba(21,101,192,0.08), 0 1px 2px rgba(21,101,192,0.06);
      --shadow-md: 0 4px 12px rgba(21,101,192,0.10), 0 2px 4px rgba(21,101,192,0.06);
      --shadow-lg: 0 12px 32px rgba(21,101,192,0.14), 0 4px 8px rgba(21,101,192,0.08);
      --shadow-xl: 0 24px 56px rgba(21,101,192,0.18), 0 8px 16px rgba(21,101,192,0.10);
      --transition: all 0.18s cubic-bezier(0.4,0,0.2,1);
    }

    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #E8F0FE; }
    ::-webkit-scrollbar-thumb { background: #90B8E8; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #1565C0; }

    button, [role="button"], a, input, select, textarea { min-height: 44px; }
    button { cursor: pointer; font-family: 'Kanit', sans-serif; }
    input, textarea, select { outline: none; font-family: 'Kanit', sans-serif; min-height: 48px; }

    * { transition: color 0.15s, background 0.15s, border-color 0.15s, box-shadow 0.15s, opacity 0.15s; }

    .t-xs  { font-size: 11px; line-height: 1.5; }
    .t-sm  { font-size: 13px; line-height: 1.5; }
    .t-base{ font-size: 15px; line-height: 1.6; }
    .t-lg  { font-size: 18px; line-height: 1.4; }
    .t-xl  { font-size: 22px; line-height: 1.3; }
    .t-2xl { font-size: 28px; line-height: 1.2; }

    *:focus-visible { outline: 3px solid #1565C0; outline-offset: 2px; border-radius: 4px; }

    @keyframes fadeUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
    @keyframes slideIn  { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
    @keyframes slideInRight { from{transform:translateX(100%);} to{transform:translateX(0);} }
    @keyframes pulse-ring { 0%,100%{transform:scale(0.95);opacity:0.7;} 50%{transform:scale(1.05);opacity:1;} }
    @keyframes float    { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }
    @keyframes ticker   { 0%{transform:translateX(0);} 100%{transform:translateX(-50%);} }
    @keyframes spin     { to{transform:rotate(360deg);} }
    @keyframes gradient-shift { 0%,100%{background-position:0% 50%;} 50%{background-position:100% 50%;} }
    @keyframes progress-fill  { from{width:0;} to{width:var(--target-width,100%);} }

    .anim-up  { animation: fadeUp  0.5s cubic-bezier(0.4,0,0.2,1) both; }
    .anim-in  { animation: fadeIn  0.3s ease both; }
    .anim-slide { animation: slideIn 0.35s cubic-bezier(0.4,0,0.2,1) both; }

    .delay-1 { animation-delay: 0.05s; }
    .delay-2 { animation-delay: 0.10s; }
    .delay-3 { animation-delay: 0.15s; }
    .delay-4 { animation-delay: 0.20s; }
    .delay-5 { animation-delay: 0.25s; }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
