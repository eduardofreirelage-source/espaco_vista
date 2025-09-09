document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================================
    // Bloco Único de JavaScript: Lógica Principal, UI, e Inicialização
    // ===================================================================================
    
    /* ===================== CONFIG ===================== */
    const RPC_FILTER_FUNC = 'filter_vendas';
    const RPC_KPI_FUNC = 'kpi_vendas_unificado';
    const RPC_CHART_MONTH_FUNC = 'chart_vendas_mes_v1';
    const RPC_CHART_DOW_FUNC = 'chart_vendas_dow_v1';
    const RPC_CHART_HOUR_FUNC = 'chart_vendas_hora_v1';
    const RPC_CHART_TURNO_FUNC = 'chart_vendas_turno_v1';
    const RPC_DIAGNOSTIC_FUNC = 'diagnostico_geral';

    const DEST_INSERT_TABLE= 'vendas_xlsx';
    
    const SUPABASE_URL  = "https://msmyfxgrnuusnvoqyeuo.supabase.co";
    const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbXlmeGdybnV1c252b3F5ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY2NTYzMTEsImV4cCI6MjA3MjIzMjMxMX0.21NV7RdrdXLqA9-PIG9TP2aZMgIseW7_qM1LDZzkO7U";
    const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    
    /* ===================== CHART.JS — tema vinho ===================== */
    Chart.defaults.font.family = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol"';
    Chart.defaults.color = '#334155';
    Chart.defaults.plugins.legend.position = 'top';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15,23,42,.95)';
    Chart.defaults.plugins.tooltip.titleColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(148,163,184,.25)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.datasets.bar.borderRadius = 6;
    Chart.defaults.datasets.bar.borderSkipped = false;
    Chart.defaults.datasets.bar.maxBarThickness = 42;
    Chart.defaults.devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    function gradNow(ctx){
      const g = ctx.createLinearGradient(0,0,0,240);
      g.addColorStop(0,'rgba(123,30,58,0.95)');
      g.addColorStop(1,'rgba(156,53,84,0.55)');
      return g;
    }
    function gradPrev(ctx){
      const g = ctx.createLinearGradient(0,0,0,240);
      g.addColorStop(0,'rgba(148,163,184,0.85)');
      g.addColorStop(1,'rgba(203,213,225,0.45)');
      return g;
    }
    
    /* ===================== HELPERS (BLOCOS COMPLETOS E CORRIGIDOS) ===================== */
    const $ = id => document.getElementById(id);
    const setStatus=(t,k)=>{ const el=$('status'); if(el) {el.textContent=t; el.style.color=(k==='err'?'#ef4444':k==='ok'?'#10b981':'#667085');} };
    const setDiag=(msg)=>{ const el=$('diag'); if(el) el.textContent = msg || ''; };
    const info=(msg)=>{ const el=$('uploadInfo'); if(el) el.textContent = msg || ''; };
    const money=v=>(v==null||!isFinite(+v))?'R$ 0,00':'R$ '+(+v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const num =v=>(v==null||!isFinite(+v))?'0':(+v).toLocaleString('pt-BR');
    const pctf=v=>(v==null||!isFinite(+v))?'0,0%':((+v)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%';
    const rmAcc = (s)=> String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const normHeader = (s)=> rmAcc(s).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    function cleanSpaces(s){ return String(s||'').replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g,' ').replace(/\s+/g,' ').trim(); }
    function displayNormalize(s){ return cleanSpaces(s); }
    const agg = (rows) => {
      const ped = rows?.length || 0;
      let fat=0,des=0,fre=0; 
      for(const r of (rows||[])){ fat+=+r.fat||0; des+=+r.des||0; fre+=+r.fre||0; } 
      return {ped,fat,des,fre};
    };
    const formatCurrencyTick = (value) => {
      const v=Number(value)||0;
      if(Math.abs(v)>=1_000_000) return 'R$ '+(v/1_000_000).toFixed(1).replace('.',',')+' mi';
      if(Math.abs(v)>=1_000)     return 'R$ '+(v/1_000).toFixed(1).replace('.',',')+' mil';
      return 'R$ '+v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
    };
    const formatTickBy = (fmt,v) => {
      if(fmt==='count') return (Number(v)||0).toLocaleString('pt-BR');
      if(fmt==='percent'){ const n=Number(v)||0; return (n*100).toFixed(0)+'%'; }
      return formatCurrencyTick(v);
    };
    const formatValueBy = (fmt,v) => {
      if(fmt==='count') return num(v);
      if(fmt==='percent') return pctf(v);
      return money(v);
    };
    const upSVG = () => '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 4l5 6h-3v6H8v-6H5l5-6z"/></svg>';
    const downSVG = () => '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 16l-5-6h3V4h4v6h3l-5 6z"/></svg>';
    const deltaBadge = (el,curr,prev) => {
      if(!el) return;
      if(prev == null || !isFinite(prev) || +prev === 0 || curr == null || !isFinite(curr)){ el.textContent='—'; el.className='delta flat'; return; }
      const delta = (curr-prev)/prev;
      const p = delta*100;
      el.innerHTML=(p>=0? upSVG():downSVG())+' '+Math.abs(p).toFixed(1)+'%';
      el.className='delta '+(p>=0?'up':'down');
    };
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    const DateHelpers = {
      iso: (d) => d.toISOString().slice(0, 10),
      addDaysISO: (isoStr, n) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setDate(d.getDate() + n);
          return d.toISOString().slice(0, 10);
      },
      daysLen: (de, ate) => {
          if (!de || !ate) return 0;
          const d1 = new Date(de + 'T12:00:00');
          const d2 = new Date(ate + 'T12:00:00');
          return Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
      },
      monthStartISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setDate(1);
          return d.toISOString().slice(0, 10);
      },
      monthEndISO: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          d.setMonth(d.getMonth() + 1, 0);
          return d.toISOString().slice(0, 10);
      },
      addMonthsISO: (isoStr, delta) => {
          const d = new Date(isoStr + 'T12:00:00');
          const day = d.getDate();
          d.setDate(1);
          d.setMonth(d.getMonth() + delta);
          const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          d.setDate(Math.min(day, last));
          return d.toISOString().slice(0, 10);
      },
      formatYM: (isoStr) => {
          const d = new Date(isoStr + 'T12:00:00');
          const m = d.getMonth();
          const y = String(d.getFullYear()).slice(-2);
          const n = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
          return `${n[m]}/${y}`;
      },
      lastDayOfMonth: (y, m) => new Date(y, m + 1, 0).getDate(),
      isFullYear: (d1, d2) => d1.getMonth() === 0 && d1.getDate() === 1 && d2.getMonth() === 11 && d2.getDate() === 31 && d1.getFullYear() === d2.getFullYear(),
      isFullMonthsAligned: function(d1, d2) {
          return d1.getDate() === 1 && d2.getDate() === this.lastDayOfMonth(d2.getFullYear(), d2.getMonth());
      },
      shiftYear: function(date, delta) {
          const d = new Date(date);
          d.setFullYear(d.getFullYear() + delta);
          const ld = this.lastDayOfMonth(d.getFullYear(), d.getMonth());
          if (d.getDate() > ld) d.setDate(ld);
          return d;
      },
      computePrevRangeISO: function(deISO, ateISO) {
          if(!deISO || !ateISO) return {dePrev:null, atePrev:null};
          const d1 = new Date(deISO + 'T12:00:00');
          const d2 = new Date(ateISO + 'T12:00:00');
          
          if (this.isFullYear(d1, d2)) {
              const p1 = this.shiftYear(d1, -1);
              const p2 = this.shiftYear(d2, -1);
              return { dePrev: this.iso(p1), atePrev: this.iso(p2) };
          }

          if (this.isFullMonthsAligned(d1, d2)) {
              const numMonths = (d2.getFullYear() - d1.getFullYear()) * 12 + d2.getMonth() - d1.getMonth() + 1;
              const atePrevDate = new Date(d1.getTime() - 86400000);
              const dePrevDate = new Date(d1);
              dePrevDate.setMonth(dePrevDate.getMonth() - numMonths);
              return { dePrev: this.iso(dePrevDate), atePrev: this.iso(atePrevDate) };
          }

          const len = this.daysLen(deISO, ateISO);
          const atePrev = new Date(d1.getTime() - 86400000);
          const dePrev = new Date(atePrev.getTime() - (len - 1) * 86400000);
          return { dePrev: this.iso(dePrev), atePrev: this.iso(atePrev) };
      }
    };
    
    function matchPanelHeights() {
      const panel = document.querySelector('.panel');
      if (!panel) return;

      const chartCard = panel.querySelector('.card:first-child');
      const sideBar = panel.querySelector('.side');

      if (!chartCard || !sideBar) return;
      
      chartCard.style.height = 'auto';

      requestAnimationFrame(() => {
        const sideBarHeight = sideBar.offsetHeight;
        if (sideBarHeight > 0) {
          chartCard.style.height = `${sideBarHeight}px`;
        }
      });
    }

    /* ===================== MULTISELECT ===================== */
    function MultiSelect(rootId, placeholder, onChangeCallback){
      const root=$(rootId), btn=root.querySelector('.msel-btn'), panel=root.querySelector('.msel-panel');
      let options=[], selected=new Set(), filtered=[], q;

      function render(){ 
        panel.innerHTML=''; 
        q = document.createElement('input');
        q.className='msel-search'; 
        q.placeholder='Filtrar…';
        q.style.cssText = 'width: 100%; padding: 6px 8px; border: 1px solid var(--line); border-radius: 6px; margin-bottom: 6px;';
        q.addEventListener('input',()=>{
          const searchTerm = q.value.toLowerCase();
          filtered = options.filter(v => String(v).toLowerCase().includes(searchTerm)); 
          draw();
        });
        panel.appendChild(q); 
        draw();
      }
      
      function draw(){
        const currentOpts = panel.querySelector('.msel-opts-box');
        if (currentOpts) currentOpts.remove();
        
        const box=document.createElement('div');
        box.className = 'msel-opts-box';
        
        const listToRender = (q && q.value) ? filtered : options;

        listToRender.forEach((v, index)=>{
          const row=document.createElement('div'); 
          row.className='msel-opt';
          row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px; border-radius:6px; font-size: 13px; cursor:pointer;';
          row.addEventListener('mouseenter', () => row.style.backgroundColor = '#f3f4f6');
          row.addEventListener('mouseleave', () => row.style.backgroundColor = 'transparent');
          
          const cb=document.createElement('input'); 
          cb.type='checkbox'; 
          cb.value=v; 
          cb.id = `msel-${rootId}-${index}`;
          cb.checked=selected.has(v);
          
          const lb=document.createElement('label'); 
          lb.textContent=v;
          lb.style.cursor = 'pointer';
          lb.setAttribute('for', cb.id);

          cb.addEventListener('change', (e) => {
            e.stopPropagation();
            cb.checked ? selected.add(v) : selected.delete(v); 
            refresh();
            if(onChangeCallback) onChangeCallback();
          });
          
          row.appendChild(cb); 
          row.appendChild(lb); 
          box.appendChild(row);
        });
        panel.appendChild(box);
      }
      
      function refresh(){ 
        btn.textContent = selected.size===0 ? placeholder : `${selected.size} sel.`; 
      }
      
      btn.addEventListener('click',(e)=>{ e.stopPropagation(); root.classList.toggle('open'); if(root.classList.contains('open')) { panel.querySelector('.msel-search').focus(); }});
      document.addEventListener('click',(e)=>{ if(!root.contains(e.target)) root.classList.remove('open'); });
      
      return {
        setOptions(list, keepOrder=false){
          options=(list||[]).filter(v=>v!=null).map(String);
          if(!keepOrder){ options.sort((a,b)=>a.localeCompare(b,'pt-BR')); }
          filtered=options.slice(); 
          selected=new Set([...selected].filter(v=>options.includes(v)));
          render(); 
          refresh();
        },
        get(){return [...selected];},
        set(vals){
          selected=new Set((vals||[]).map(String)); 
          refresh(); 
          render();
        },
        clear() {
          selected.clear();
          refresh();
          render();
        }
      };
    }
    
    /* ===================== ESTADO / FILTROS ===================== */
    let firstDay='', lastDay='';
    let projectionDays = 30;
    let diagChartMode = 'total';
    const fxDispatchApplyDebounced = debounce(() => fxDispatchApply(), 500);
    const ms={
      unids:  MultiSelect('fxUnit', 'Todas', fxDispatchApplyDebounced),
      lojas:  MultiSelect('fxStore', 'Todas', fxDispatchApplyDebounced),
      canais: MultiSelect('fxChannel', 'Todos', fxDispatchApplyDebounced),
      turnos: MultiSelect('fxShift', 'Todos', fxDispatchApplyDebounced),
      pags:   MultiSelect('fxPay', 'Todos', fxDispatchApplyDebounced),
    };
    const fxCanceled = $('fxCanceled');
    
    /* ===================== LÓGICA DE DADOS (KPIs, Gráficos, etc.) ===================== */
    function buildParams(de, ate, analiticos) {
      const isActive = (val) => val && val.length > 0;
      let p_cancelado = null;
      if (analiticos.cancelado === 'sim') p_cancelado = 'Sim';
      if (analiticos.cancelado === 'nao') p_cancelado = 'Não';
      return {
        p_dini: de, p_dfim: ate,
        p_unids:  isActive(analiticos.unidade) ? analiticos.unidade : null,
        p_lojas:  isActive(analiticos.loja) ? analiticos.loja : null,
        p_turnos: isActive(analiticos.turno) ? analiticos.turno : null,
        p_canais: isActive(analiticos.canal) ? analiticos.canal : null,
        p_pags:   isActive(analiticos.pagamento) ? analiticos.pagamento : null,
        p_cancelado
      };
    }

    async function baseQuery(de, ate, analiticos){
      const PAGE_SIZE = 1000;
      let allRows = [];
      let page = 0;
      let keepFetching = true;
      const params = buildParams(de, ate, analiticos);

      while (keepFetching) {
          const { data, error } = await supa.rpc(RPC_FILTER_FUNC, params)
                                          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
          if (error) {
              console.error(`[RPC ${RPC_FILTER_FUNC}]`, error);
              throw error;
          }
          if (data && data.length > 0) {
              allRows.push(...data);
              page++;
              if (data.length < PAGE_SIZE) {
                  keepFetching = false;
              }
          } else {
              keepFetching = false;
          }
      }
      return allRows;
    }

    function renderVendasKPIs(allKpiValues) {
        if (!allKpiValues) {
            document.querySelectorAll('.kpi .val, .kpi .sub span').forEach(el => el.textContent = '—');
            document.querySelectorAll('.kpi .delta').forEach(el => { el.textContent = '—'; el.className = 'delta flat'; });
            return;
        };

        Object.keys(allKpiValues).forEach(key => {
            const kpi = allKpiValues[key];
            const valEl = $(`k_${key}`);
            const prevEl = $(`p_${key}`);
            const deltaEl = $(`d_${key}`);
            if (valEl) valEl.textContent = formatValueBy(KPI_META[key].fmt, kpi.current);
            if (prevEl) prevEl.textContent = formatValueBy(KPI_META[key].fmt, kpi.previous);
            if (deltaEl) deltaBadge(deltaEl, kpi.current, kpi.previous);
        });
    }

    async function updateKPIs(de, ate, dePrev, atePrev, analiticos){
        let allKpiValues = {};
        try {
            const pTotalNow = buildParams(de, ate, { ...analiticos, cancelado: 'ambos' });
            const pTotalPrev = buildParams(dePrev, atePrev, { ...analiticos, cancelado: 'ambos' });

            const buildCountQuery = (startDate, endDate, cancelFilter) => {
                let query = supa.from('vendas_canon').select('*', { count: 'exact', head: true })
                    .gte('dia', startDate)
                    .lte('dia', endDate);
                
                const isActive = (val) => val && val.length > 0;
                if (isActive(analiticos.unidade)) query = query.in('unidade', analiticos.unidade);
                if (isActive(analiticos.loja)) query = query.in('loja', analiticos.loja);
                if (isActive(analiticos.turno)) query = query.in('turno', analiticos.turno);
                if (isActive(analiticos.canal)) query = query.in('canal', analiticos.canal);
                if (isActive(analiticos.pagamento)) query = query.in('pagamento_base', analiticos.pagamento);
                
                if (cancelFilter === 'Sim') query = query.eq('cancelado', 'Sim');
                if (cancelFilter === 'Não') query = query.eq('cancelado', 'Não');

                return query;
            };

            const [
                totalFinNowResult, totalFinPrevResult,
                { count: pedNowCount, error: errPedNow },
                { count: pedPrevCount, error: errPedPrev },
                { count: cnCount, error: errCn }, { count: vnCount, error: errVn },
                { count: cpCount, error: errCp }, { count: vpCount, error: errVp }
            ] = await Promise.all([
                supa.rpc(RPC_KPI_FUNC, pTotalNow),
                supa.rpc(RPC_KPI_FUNC, pTotalPrev),
                buildCountQuery(de, ate, null),
                buildCountQuery(dePrev, atePrev, null),
                buildCountQuery(de, ate, 'Sim'),
                buildCountQuery(de, ate, 'Não'),
                buildCountQuery(dePrev, atePrev, 'Sim'),
                buildCountQuery(dePrev, atePrev, 'Não')
            ]);

            if(totalFinNowResult.error) throw totalFinNowResult.error;
            if(errPedNow) throw errPedNow;
            
            const {data: cancDataNow} = await supa.rpc(RPC_KPI_FUNC, { ...buildParams(de, ate, analiticos), p_cancelado: 'Sim' });
            const {data: cancDataPrev} = await supa.rpc(RPC_KPI_FUNC, { ...buildParams(dePrev, atePrev, analiticos), p_cancelado: 'Sim' });

            const pedTotalNow = analiticos.cancelado === 'sim' ? cnCount : analiticos.cancelado === 'nao' ? vnCount : pedNowCount;
            const pedTotalPrev = analiticos.cancelado === 'sim' ? cpCount : analiticos.cancelado === 'nao' ? vpCount : pedPrevCount;

            const totalNow = { fat: +(totalFinNowResult.data[0]?.fat || 0), des: +(totalFinNowResult.data[0]?.des || 0), fre: +(totalFinNowResult.data[0]?.fre || 0) };
            const totalPrev = { fat: +(totalFinPrevResult.data[0]?.fat || 0), des: +(totalFinPrevResult.data[0]?.des || 0), fre: +(totalFinPrevResult.data[0]?.fre || 0) };
            const cancNow = { fat: +(cancDataNow[0]?.fat || 0), des: +(cancDataNow[0]?.des || 0), fre: +(cancDataNow[0]?.fre || 0) };
            const cancPrev = { fat: +(cancDataPrev[0]?.fat || 0), des: +(cancDataPrev[0]?.des || 0), fre: +(cancDataPrev[0]?.fre || 0) };

            let N_financial, P_financial;
            if (analiticos.cancelado === 'nao') {
                N_financial = { fat: totalNow.fat - cancNow.fat, des: totalNow.des - cancNow.des, fre: totalNow.fre - cancNow.fre };
                P_financial = { fat: totalPrev.fat - cancPrev.fat, des: totalPrev.des - cancPrev.des, fre: totalPrev.fre - cancPrev.fre };
            } else if (analiticos.cancelado === 'sim') {
                N_financial = cancNow;
                P_financial = cancPrev;
            } else {
                N_financial = totalNow;
                P_financial = totalPrev;
            }
            
            const N = { ped: pedTotalNow, ...N_financial };
            const P = { ped: pedTotalPrev, ...P_financial };

            const len = DateHelpers.daysLen(de, ate);
            const prevLen = DateHelpers.daysLen(dePrev, atePrev);

            const tktN = (N.ped > 0) ? (N.fat / N.ped) : 0;
            const tktP = (P.ped > 0) ? (P.fat / P.ped) : 0;
            const fatMedN = len > 0 ? (N.fat / len) : 0;
            const fatMedP = prevLen > 0 ? (P.fat / prevLen) : 0;
            const desPercN = N.fat > 0 ? (N.des / N.fat) : 0;
            const desPercP = P.fat > 0 ? (P.des / P.fat) : 0;
            const freMedN = N.ped > 0 ? (N.fre / N.ped) : 0;
            const freMedP = P.ped > 0 ? (P.fre / P.ped) : 0;
            const roiN = N.des > 0 ? (N.fat - N.des) / N.des : NaN;
            const roiP = P.des > 0 ? (P.fat - P.des) / P.des : NaN;

            allKpiValues = {
                fat: { current: N.fat, previous: P.fat },
                ped: { current: N.ped, previous: P.ped },
                tkt: { current: tktN, previous: tktP },
                des: { current: N.des, previous: P.des },
                fatmed: { current: fatMedN, previous: fatMedP },
                roi: { current: roiN, previous: roiP },
                desperc: { current: desPercN, previous: desPercP },
                canc_val: { current: cancNow.fat, previous: cancPrev.fat },
                fre: { current: N.fre, previous: P.fre },
                fremed: { current: freMedN, previous: freMedP },
                canc_ped: { current: cnCount, previous: cpCount },
            };

        } catch (e) {
            console.error("Erro detalhado em updateKPIs:", e);
            return null;
        }
        return allKpiValues;
    }

    async function getAndRenderUnitKPIs(kpi_key, de, ate, dePrev, atePrev, analiticos) {
      const mainKpiCard = $('hero_main_kpi');
      if (mainKpiCard) {
          const mainValueEl = mainKpiCard.querySelector('.hero-value-number');
          const mainDeltaEl = mainKpiCard.querySelector('.delta');
          const mainSubEl = mainKpiCard.querySelector('.hero-sub-value');
          
          const totalAnaliticos = {...analiticos, unidade: [], loja: []};
          const totalKpis = await updateKPIs(de, ate, dePrev, atePrev, totalAnaliticos);
          
          if(totalKpis && totalKpis[kpi_key]) {
              const meta = KPI_META[kpi_key];
              mainValueEl.textContent = formatValueBy(meta.fmt, totalKpis[kpi_key].current);
              mainSubEl.textContent = 'Anterior: ' + formatValueBy(meta.fmt, totalKpis[kpi_key].previous);
              deltaBadge(mainDeltaEl, totalKpis[kpi_key].current, totalKpis[kpi_key].previous);
          }
      }

      const fetchAndCalculateForUnit = async (unitName) => {
          const unitAnaliticos = { ...analiticos, unidade: [unitName] };
          return await updateKPIs(de, ate, dePrev, atePrev, unitAnaliticos);
      };
    
      try {
          const [rajaKpis, savassiKpis] = await Promise.all([
            fetchAndCalculateForUnit('Uni.Raja'), 
            fetchAndCalculateForUnit('Uni.Savassi')
          ]);

          const kpiMeta = KPI_META[kpi_key] || { fmt: 'money' };
          const renderUnit = (unitId, unitData) => {
            const card = $(unitId);
            const data = unitData?.[kpi_key];
            if (card && data) {
              card.querySelector('.unit-kpi-value').textContent = formatValueBy(kpiMeta.fmt, data.current);
              card.querySelector('.unit-kpi-sub').textContent = 'Anterior: ' + formatValueBy(kpiMeta.fmt, data.previous);
              deltaBadge(card.querySelector('.delta'), data.current, data.previous);
            } else if (card) {
                card.querySelector('.unit-kpi-value').textContent = '—';
                card.querySelector('.unit-kpi-sub').textContent = 'Anterior: —';
                deltaBadge(card.querySelector('.delta'), null, null);
            }
          };

          renderUnit('unit-kpi-raja', rajaKpis);
          renderUnit('unit-kpi-savassi', savassiKpis);
          
      } catch(e) {
          console.error("Erro ao renderizar KPIs de unidade:", e);
      }
    }
    
    async function updateProjections(de, ate, dePrev, atePrev, analiticos) {
        const kpiKey = $('kpi-select').value;
        const meta = KPI_META[kpiKey] || { fmt: 'money' };

        const calculateTrendProjection = (current, previous) => {
            if (current == null || !isFinite(current) || previous == null || !isFinite(previous) || previous === 0) {
                return { value: current, deltaVal: 0 };
            }
            const delta = (current - previous) / previous;
            return { value: current * (1 + delta), deltaVal: delta };
        };

        const len = DateHelpers.daysLen(de, ate);
        const projectionMultiplier = len > 0 ? projectionDays / len : 1;

        const resetUI = (scope) => {
            $('proj_total_label').textContent = `PROJEÇÃO ${meta.label.toUpperCase()} (${projectionDays}D)`;
            $('proj_raja_label').textContent = `UNI.RAJA - ${meta.label}`;
            $('proj_savassi_label').textContent = `UNI.SAVASSI - ${meta.label}`;
            if(scope === 'total' || scope === 'all') {
                $('proj_total_val').textContent = '—';
                deltaBadge($('proj_total_delta'), null, null);
            }
            if(scope === 'raja' || scope === 'all') {
                $('proj_raja_val').textContent = '—';
                deltaBadge($('proj_raja_delta'), null, null);
            }
            if(scope === 'savassi' || scope === 'all') {
                $('proj_savassi_val').textContent = '—';
                deltaBadge($('proj_savassi_delta'), null, null);
            }
        };
        resetUI('all');

        try {
            const [totalData, rajaData, savassiData] = await Promise.all([
                updateKPIs(de, ate, dePrev, atePrev, analiticos),
                updateKPIs(de, ate, dePrev, atePrev, { ...analiticos, unidade: ['Uni.Raja'] }),
                updateKPIs(de, ate, dePrev, atePrev, { ...analiticos, unidade: ['Uni.Savassi'] })
            ]);

            if (totalData && totalData[kpiKey]) {
                const projTotal = calculateTrendProjection(totalData[kpiKey].current, totalData[kpiKey].previous);
                $('proj_total_val').textContent = projTotal.value !== null ? formatValueBy(meta.fmt, projTotal.value * projectionMultiplier) : '—';
                deltaBadge($('proj_total_delta'), projTotal.value, totalData[kpiKey].current);
            }

            if (rajaData && rajaData[kpiKey]) {
                const projRaja = calculateTrendProjection(rajaData[kpiKey].current, rajaData[kpiKey].previous);
                $('proj_raja_val').textContent = projRaja.value !== null ? formatValueBy(meta.fmt, projRaja.value * projectionMultiplier) : '—';
                deltaBadge($('proj_raja_delta'), projRaja.value, rajaData[kpiKey].current);
            }
            
            if (savassiData && savassiData[kpiKey]) {
                const projSavassi = calculateTrendProjection(savassiData[kpiKey].current, savassiData[kpiKey].previous);
                $('proj_savassi_val').textContent = projSavassi.value !== null ? formatValueBy(meta.fmt, projSavassi.value * projectionMultiplier) : '—';
                deltaBadge($('proj_savassi_delta'), projSavassi.value, savassiData[kpiKey].current);
            }

        } catch (error) {
            console.error("Erro ao calcular projeções:", error);
            resetUI('all');
        }
    }

    let chartModeGlobal = 'total';
    const segGlobal = $('segGlobal');
    segGlobal.addEventListener('click',(e)=>{
      const btn=e.target.closest('button'); if(!btn) return;
      chartModeGlobal = btn.dataset.mode;
      segGlobal.querySelectorAll('button').forEach(b=> b.classList.toggle('active', b===btn));
      document.dispatchEvent(new Event('filters:apply:internal'));
    });
    function ensureChart(canvasId, labels, nowArr, prevArr, tooltipExtra='', fmt='money'){
      const canvas=$(canvasId); if(!canvas) return;
      if(canvas.__chart){ try{canvas.__chart.destroy();}catch(e){} canvas.__chart=null; }
      const ctx=canvas.getContext('2d');
      const chart=new Chart(ctx,{
        type:'bar',
        data:{ labels, datasets:[
          {label:'Atual', data:nowArr.map(v=>+v||0), backgroundColor:gradNow(ctx)},
          {label:'Anterior', data:prevArr.map(v=>+v||0), backgroundColor:gradPrev(ctx)}
        ]},
        options:{
          responsive:true, maintainAspectRatio:false, animation:false,
          scales:{ x:{grid:{display:false}}, y:{beginAtZero:true, grid:{color:'rgba(0,0,0,0.05)'}, ticks:{callback:(v)=>formatTickBy(fmt,v)}}},
          plugins:{ legend:{position:'top'},
            tooltip:{mode:'index',intersect:false,callbacks:{
              label:(ctx)=>`${ctx.dataset.label}: ${formatValueBy(fmt, ctx.parsed.y||0)}`,
              footer:()=> tooltipExtra
            }}
          }
        }
      });
      canvas.__chart=chart;
    }
    let selectedKPI = 'fat';
    const KPI_META = {
      fat:       { label:'Faturamento',         fmt:'money' },
      ped:       { label:'Pedidos',             fmt:'count' },
      tkt:       { label:'Ticket Médio',        fmt:'money' },
      des:       { label:'Incentivos',          fmt:'money' },
      desperc:   { label:'% Incentivos',     fmt:'percent' },
      fre:       { label:'Frete',               fmt:'money' },
      fremed:    { label:'Frete Médio',         fmt:'money' },
      fatmed:    { label:'Faturamento Médio',   fmt:'money' },
      canc_ped:  { label:'Pedidos cancelados',  fmt:'count' },
      canc_val:  { label:'Valor de cancelados', fmt:'money' },
      roi:       { label:'ROI',                 fmt:'percent' },
    };
    function wantedCancelFilterForKPI(){
      const m=KPI_META[selectedKPI];
      return m?.needsCancel||null;
    }
    function effectiveMode(){
      const m=KPI_META[selectedKPI];
      return m?.forceMode || chartModeGlobal;
    }
    function updateChartTitles(){
      const m=KPI_META[selectedKPI]||KPI_META.fat;
      const mode = effectiveMode()==='media' ? ' (média)' : '';
      $('title_month').textContent = `${m.label}${mode} por mês — últimos 12M vs. 12M anteriores`;
      $('title_dow').textContent   = `${m.label}${mode} por dia da semana`;
      $('title_hour').textContent  = `${m.label}${mode} por hora`;
      $('title_turno').textContent = `${m.label}${mode} por turno`;
      $('title_top6').textContent  = `Participação por loja — Top 6 (${m.label}${mode})`;
    }
    function bindKPIClick(){
      document.querySelectorAll('.kpi[data-kpi]').forEach(card=>{
        card.addEventListener('click', ()=>{
          selectedKPI = card.dataset.kpi;
          document.querySelectorAll('.kpi[data-kpi]').forEach(k=>k.classList.toggle('active', k===card));
          document.dispatchEvent(new Event('filters:apply:internal'));
        });
      });
    }
    
    async function updateCharts(de, ate, dePrev, atePrev, analiticos) {
      const meta = KPI_META[selectedKPI] || KPI_META.fat;
      const mode = effectiveMode();
      try {
          setDiag('');
          const paramsNow = buildParams(de, ate, analiticos);
          const paramsPrev = buildParams(dePrev, atePrev, analiticos);

          const [
              {data: dowData}, {data: dowDataPrev},
              {data: hourData}, {data: hourDataPrev},
              {data: turnoData}, {data: turnoDataPrev}
          ] = await Promise.all([
              supa.rpc(RPC_CHART_DOW_FUNC, paramsNow),
              supa.rpc(RPC_CHART_DOW_FUNC, paramsPrev),
              supa.rpc(RPC_CHART_HOUR_FUNC, paramsNow),
              supa.rpc(RPC_CHART_HOUR_FUNC, paramsPrev),
              supa.rpc(RPC_CHART_TURNO_FUNC, paramsNow),
              supa.rpc(RPC_CHART_TURNO_FUNC, paramsPrev),
          ]);
          
          const tip = `Período anterior: ${dePrev} → ${atePrev}`;
          const valueKey = mode === 'media' ? 'media' : 'total';
          
          {
              const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
              const nArr = Array(7).fill(0), pArr = Array(7).fill(0);
              (dowData || []).forEach(r => nArr[r.dow] = r[valueKey]);
              (dowDataPrev || []).forEach(r => pArr[r.dow] = r[valueKey]);
              ensureChart('ch_dow', labels, nArr, pArr, tip, KPI_META[selectedKPI].fmt);
          }
          {
              const nArr = Array(24).fill(0), pArr = Array(24).fill(0);
              (hourData || []).forEach(r => nArr[r.h] = r[valueKey]);
              (hourDataPrev || []).forEach(r => pArr[r.h] = r[valueKey]);
              let minHour = 24, maxHour = -1;
              for (let i = 0; i < 24; i++) {
                  if (nArr[i] > 0 || pArr[i] > 0) {
                      if (i < minHour) minHour = i;
                      if (i > maxHour) maxHour = i;
                  }
              }
              if (minHour > maxHour) {
                  ensureChart('ch_hour', [], [], [], tip, KPI_META[selectedKPI].fmt);
              } else {
                  const range = Array.from({length: maxHour - minHour + 1}, (_, i) => i + minHour);
                  const labels = range.map(h => String(h).padStart(2, '0') + 'h');
                  const nowData = range.map(h => nArr[h]);
                  const prevData = range.map(h => pArr[h]);
                  ensureChart('ch_hour', labels, nowData, prevData, tip, KPI_META[selectedKPI].fmt);
              }
          }
          {
              const labels = ['Dia', 'Noite'];
              const nMap = new Map(), pMap = new Map();
              (turnoData || []).forEach(r => nMap.set(r.turno, r[valueKey]));
              (turnoDataPrev || []).forEach(r => pMap.set(r.turno, r[valueKey]));
              const nArr = labels.map(l => nMap.get(l) || 0);
              const pArr = labels.map(l => pMap.get(l) || 0);
              ensureChart('ch_turno', labels, nArr, pArr, tip, KPI_META[selectedKPI].fmt);
          }
      } catch (e) {
          console.error("Erro ao atualizar gráficos analíticos:", e); 
          setDiag('Erro ao atualizar gráficos');
      }
    }
    async function updateMonth12x12(analiticos){
      try{
        const end = lastDay || DateHelpers.iso(new Date());
        const endMonthStart = DateHelpers.monthStartISO(end);
        const last12Start = DateHelpers.addMonthsISO(endMonthStart, -11);
        const prev12Start = DateHelpers.addMonthsISO(endMonthStart, -23);
        const last12End   = DateHelpers.monthEndISO(end);
        const prev12EndAdj= DateHelpers.monthEndISO(DateHelpers.addMonthsISO(endMonthStart, -12));
        const meta = KPI_META[selectedKPI]||KPI_META.fat;
        
        const paramsNow = buildParams(last12Start, last12End, analiticos);
        const paramsPrev = buildParams(prev12Start, prev12EndAdj, analiticos);

        const [{data: nData, error: nErr}, {data: pData, error: pErr}] = await Promise.all([
            supa.rpc(RPC_CHART_MONTH_FUNC, paramsNow),
            supa.rpc(RPC_CHART_MONTH_FUNC, paramsPrev)
        ]);

        if (nErr) throw nErr;
        if (pErr) throw pErr;

        const mode = effectiveMode();
        const valueKey = mode === 'media' ? 'media' : 'total';
        
        const toMap = (arr)=> new Map((arr||[]).map(r=>[r.ym, +r[valueKey]||0]));
        const mNow = toMap(nData), mPrev = toMap(pData);
        
        let labels = [];
        const ymsNow = []; 
        let cur = last12Start;
        for(let i=0;i<12;i++){ 
            labels.push(DateHelpers.formatYM(cur)); 
            const d=new Date(cur+'T12:00:00'); 
            const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; 
            ymsNow.push(ym); 
            cur=DateHelpers.addMonthsISO(cur,1); 
        }

        const ymsPrev = ymsNow.map(ym=>{ const [yy,mm]=ym.split('-').map(Number); const p=new Date(yy,mm-1-12,1); return `${p.getFullYear()}-${String(p.getMonth()+1).padStart(2,'0')}`; });
        
        const nowArr  = ymsNow.map(ym => mNow.get(ym)||0);
        const prevArr = ymsPrev.map(ym => mPrev.get(ym)||0);
        const tip = `Comparação fixa: Últimos 12M vs 12M anteriores`;
        ensureChart('ch_month', labels, nowArr, prevArr, tip, meta.fmt);
      }catch(e){
        console.error("Erro detalhado em updateMonth12x12:", e); 
        setDiag('Erro ao atualizar gráfico mensal');
      }
    }
    const wine = ["#7b1e3a","#8c2947","#9c3554","#ad4061","#bd4c6e","#ce577b", "#e5e7eb"];
    function ensureDonutTop6(labels, values, centerText, fmt='money'){
      const cvs = $('ch_top6'); if(!cvs) return;
      if(cvs.__chart){ try{cvs.__chart.destroy();}catch(e){} cvs.__chart=null; }
      const ctx = cvs.getContext('2d');
      const total = (values||[]).reduce((a,b)=>a+(+b||0),0);
      $('top6Center').textContent = (centerText!=null ? centerText : 'Total: '+(fmt==='money'?money(total): fmt==='count'? num(total) : formatValueBy(fmt, total)));
      const chart = new Chart(ctx,{
        type:'doughnut',
        data:{ labels, datasets:[{ data: values, backgroundColor: wine, hoverBackgroundColor: wine, borderColor:'#fff', borderWidth:1 }]},
        options:{
          responsive:true, maintainAspectRatio:false, cutout:'60%',
          plugins:{
            legend:{ position:'right', labels:{ usePointStyle:true, pointStyle:'circle', boxWidth:10, padding:16, color:'#334155' } },
            tooltip:{ callbacks:{ label:(ctx)=>{ const label = ctx.label||''; const val = ctx.parsed||0; const ds = ctx.chart.data.datasets[0]; const tt = (ds.data||[]).reduce((a,b)=>a+(+b||0),0); const perc = tt ? ((val/tt)*100).toFixed(1) : 0; return `${label}: ${formatValueBy(KPI_META[selectedKPI]?.fmt||'money', val)} (${perc}%)`; } },
              backgroundColor:'rgba(15,23,42,.95)', titleColor:'#e2e8f0', bodyColor:'#e2e8f0', borderColor:'rgba(148,163,184,.25)', borderWidth:1 }
          }
        }
      });
      cvs.__chart = chart;
    }
    async function updateTop6(de, ate, analiticos){
      try{
        const meta = KPI_META[selectedKPI]||KPI_META.fat;
        const data = await baseQuery(de, ate, analiticos);
        const m = new Map();
        (data||[]).forEach(r=>{
          const loja = r.loja || '—';
          if(!m.has(loja)) m.set(loja, {fat:0, des:0, fre:0, ped:0, dias: new Set()});
          const acc = m.get(loja);
          acc.fat += +r.fat||0;
          acc.des += +r.des||0;
          acc.fre += +r.fre||0;
          acc.ped += 1;
          acc.dias.add(r.dia);
        });

        function metricVal(aggData){
          const mode = effectiveMode();
          const isRatio = ['tkt','desperc','fremed','roi'].includes(selectedKPI);
          if (isRatio) {
            switch(selectedKPI){
                case 'tkt': return (aggData.ped>0) ? aggData.fat/aggData.ped : 0;
                case 'desperc': return (aggData.fat>0) ? aggData.des/aggData.fat : 0;
                case 'fremed': return (aggData.ped>0) ? aggData.fre/aggData.ped : 0;
                case 'roi': return (aggData.des>0) ? (aggData.fat - aggData.des)/aggData.des : 0;
            }
          } else {
            const numDays = aggData.dias.size || 1;
            switch(selectedKPI){
                case 'fat': return mode==='media' ? aggData.fat / numDays : aggData.fat;
                case 'ped': return mode==='media' ? aggData.ped / numDays : aggData.ped;
                case 'des': return mode==='media' ? aggData.des / numDays : aggData.des;
                case 'fre': return mode==='media' ? aggData.fre / numDays : aggData.fre;
                case 'fatmed': return aggData.fat / numDays;
                case 'canc_ped': return mode==='media' ? aggData.ped / numDays : aggData.ped;
                case 'canc_val': return mode==='media' ? aggData.fat / numDays : aggData.fat;
            }
          }
          return 0;
        }

        const allStoresData = Array.from(m.entries()).map(([loja, aggData]) => ({ loja, valor: metricVal(aggData) }));
        allStoresData.sort((a,b)=> b.valor - a.valor);
        
        let finalData = allStoresData;
        if (allStoresData.length > 6) {
            const top5 = allStoresData.slice(0, 5);
            const othersValue = allStoresData.slice(5).reduce((acc, curr) => acc + curr.valor, 0);
            if (othersValue > 0.01) { 
              finalData = [...top5, { loja: 'Outros', valor: othersValue }];
            } else {
              finalData = top5;
            }
        }
        
        const labels = finalData.map(d => d.loja);
        const values = finalData.map(d => d.valor);
        const total = allStoresData.reduce((sum, item) => sum + item.valor, 0);
        ensureDonutTop6(labels, values, `Total: ${formatValueBy(meta.fmt, total)}`, meta.fmt);

      }catch(e){
        console.warn('top6 erro:', e.message||e);
        ensureDonutTop6([],[], 'Total: R$ 0,00','money');
      }
    }
    
    function ensureSingleSeriesChart(canvasId, labels, dataArr, meta, type = 'bar') {
        const canvas = $(canvasId); if (!canvas) return;
        if (canvas.__chart) { try { canvas.__chart.destroy(); } catch (e) {} canvas.__chart = null; }
        const ctx = canvas.getContext('2d');
        
        const chart = new Chart(ctx, {
            type: type,
            data: {
                labels,
                datasets: [{
                    label: meta.label,
                    data: dataArr.map(v => +v || 0),
                    backgroundColor: type === 'bar' ? gradNow(ctx) : 'rgba(123, 30, 58, 0.1)',
                    borderColor: '#7b1e3a',
                    borderWidth: 2,
                    pointBackgroundColor: '#7b1e3a',
                    tension: 0.1,
                    fill: type === 'line'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: (v) => formatTickBy(meta.fmt, v) } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatValueBy(meta.fmt, ctx.parsed.y || 0)}`
                        }
                    }
                }
            }
        });
        canvas.__chart = chart;
    }

    async function updateDiagnosticCharts(de, ate, analiticos) {
        try {
            const selectedKpi = $('kpi-select').value;
            const meta = KPI_META[selectedKpi] || KPI_META.fat;
            
            $('diag_title_month').textContent = `${meta.label} por Mês`;
            $('diag_title_dow').textContent = `${meta.label} por Dia da Semana`;
            $('diag_title_hour').textContent = `${meta.label} por Hora`;

            const paramsNow = buildParams(de, ate, analiticos);

            const [
                { data: monthData, error: monthErr },
                { data: dowData, error: dowErr },
                { data: hourData, error: hourErr }
            ] = await Promise.all([
                supa.rpc(RPC_CHART_MONTH_FUNC, paramsNow),
                supa.rpc(RPC_CHART_DOW_FUNC, paramsNow),
                supa.rpc(RPC_CHART_HOUR_FUNC, paramsNow)
            ]);

            if (monthErr || dowErr || hourErr) throw (monthErr || dowErr || hourErr);

            const valueKey = diagChartMode;

            {
                const labels = (monthData || []).map(r => DateHelpers.formatYM(r.ym + '-01T12:00:00'));
                const dataArr = (monthData || []).map(r => +r[valueKey] || 0);
                ensureSingleSeriesChart('diag_ch_month', labels, dataArr, meta, 'line');
            }

            {
                const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const dataArr = Array(7).fill(0);
                (dowData || []).forEach(r => dataArr[r.dow] = r[valueKey]);
                ensureSingleSeriesChart('diag_ch_dow', labels, dataArr, meta, 'bar');
            }

            {
                const dataArr = Array(24).fill(0);
                (hourData || []).forEach(r => dataArr[r.h] = r[valueKey]);
                let minHour = 24, maxHour = -1;
                for (let i = 0; i < 24; i++) {
                    if (dataArr[i] > 0) {
                        if (i < minHour) minHour = i;
                        if (i > maxHour) maxHour = i;
                    }
                }

                if (minHour > maxHour) {
                    ensureSingleSeriesChart('diag_ch_hour', [], [], meta, 'bar');
                } else {
                    const range = Array.from({ length: maxHour - minHour + 1 }, (_, i) => i + minHour);
                    const labels = range.map(h => String(h).padStart(2, '0') + 'h');
                    const slicedData = range.map(h => dataArr[h]);
                    ensureSingleSeriesChart('diag_ch_hour', labels, slicedData, meta, 'bar');
                }
            }
        } catch (e) {
            console.error("Erro ao atualizar gráficos de diagnóstico:", e);
            ensureSingleSeriesChart('diag_ch_month', [], [], {}, 'line');
            ensureSingleSeriesChart('diag_ch_dow', [], [], {}, 'bar');
            ensureSingleSeriesChart('diag_ch_hour', [], [], {}, 'bar');
        }
    }
    
    async function updateInsights(de, ate, analiticos, kpi_key) {
        const insightsContainer = document.querySelector('#tab-diagnostico .ins-list');
        const contextContainer = document.querySelector('#tab-diagnostico .hero-context');
        if (!insightsContainer || !contextContainer) return;

        insightsContainer.innerHTML = `<p class="muted" style="text-align:center; padding: 20px;">Gerando insights...</p>`;
        contextContainer.innerHTML = '<strong>Destaques:</strong> Carregando...';

        try {
            const isActive = (val) => val && val.length > 0;
            const params = {
                p_dini: de,
                p_dfim: ate,
                p_kpi_key: kpi_key,
                p_unids:  isActive(analiticos.unidade) ? analiticos.unidade : null,
                p_lojas:  isActive(analiticos.loja) ? analiticos.loja : null,
                p_turnos: isActive(analiticos.turno) ? analiticos.turno : null,
                p_pags:   isActive(analiticos.pagamento) ? analiticos.pagamento : null
            };

            const { data, error } = await supa.rpc(RPC_DIAGNOSTIC_FUNC, params);

            if (error) throw error;
            if (!data) throw new Error("A resposta da função de diagnóstico está vazia.");
            
            if(data.context) {
                const { top_stores, top_hours, top_channels } = data.context;
                let contextHTML = '<strong>Destaques:</strong> ';
                if(top_stores && top_stores.length > 0) contextHTML += `Lojas: ${top_stores.join(' • ')} • `;
                if(top_hours && top_hours.length > 0) contextHTML += `Horário: ${top_hours.join(' • ')} • `;
                if(top_channels && top_channels.length > 0) contextHTML += `Canal: ${top_channels.join(' • ')}`;
                contextContainer.innerHTML = contextHTML;
            } else {
                 contextContainer.innerHTML = '<strong>Destaques:</strong> Nenhum dado de contexto retornado.';
            }

            let insightsArray = [];
            if (data.context) {
                const { top_stores, top_hours } = data.context;
                const kpiLabel = KPI_META[kpi_key]?.label || 'o indicador';
                const isPositive = data.hero.delta >= 0;

                if(top_stores && top_stores.length > 0) {
                    insightsArray.push({
                        type: isPositive ? 'up' : 'down',
                        title: `Performance por Loja (${kpiLabel})`,
                        subtitle: `As lojas ${top_stores.join(', ')} apresentaram maior impacto no período.`,
                        action: 'Ação: Analisar as práticas destas lojas para replicar os sucessos ou corrigir as falhas.'
                    });
                }
                if(top_hours && top_hours.length > 0) {
                    insightsArray.push({
                        type: 'up',
                        title: 'Oportunidade de Horário de Pico',
                        subtitle: `O período de ${top_hours.join(', ')} concentra a maior parte da performance.`,
                        action: 'Ação: Reforçar marketing e promoções focadas neste horário para maximizar o resultado.'
                    });
                }
            }

            if (insightsArray.length === 0) {
                insightsContainer.innerHTML = '<p class="muted" style="text-align:center; padding: 20px;">Nenhum insight de texto gerado para este período.</p>';
                return;
            }

            let allInsightsHTML = '';
            insightsArray.forEach(insight => {
                const insightHTML = `
                    <div class="ins-card ${insight.type || ''}">
                        <div class="dot"></div>
                        <div>
                            <div class="ins-title">${insight.title || ''}</div>
                            <div class="ins-sub">${insight.subtitle || ''}</div>
                            <div class="ins-action">${insight.action || ''}</div>
                        </div>
                    </div>
                `;
                allInsightsHTML += insightHTML;
            });
            insightsContainer.innerHTML = allInsightsHTML;

        } catch (e) {
            console.error("Erro ao carregar insights de IA:", e);
            insightsContainer.innerHTML = `<p class="muted" style="text-align:center; padding: 20px; color: var(--down);">Erro ao carregar insights.</p>`;
            contextContainer.innerHTML = '<strong>Destaques:</strong> Erro ao carregar.';
        }
    }
    
    // ===================================================================================
    // LÓGICA DE IMPORTAÇÃO
    // ===================================================================================
    $('btnUpload').addEventListener('click', ()=> $('fileExcel').click());
    
    $('fileExcel').addEventListener('change', async (ev)=>{
        const file = ev.target.files?.[0];
        if(!file){ info(''); return; }
        
        setStatus('Processando arquivo...', 'info');
        try{
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type:'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(ws, { raw:false, defval:null });

            if (!json || json.length === 0) {
                throw new Error("O arquivo está vazio ou em um formato inválido.");
            }
            
            const headerMap = {
                'data': 'data_completa',
                'unidade': 'unidade',
                ' loja': 'loja',
                'canal': 'canal_de_venda',
                'pagamento': 'pagamento_base',
                'cancelado': 'cancelado',
                'pedido': 'pedidos',
                'total': 'fat',
                'desconto': 'des',
                'entrega': 'fre',
                'número do pedido no parceiro': 'pedido_id'
            };
    
            const transformedJson = json.map((row, index) => {
                const newRow = {};
                let tempPedidoId = null;

                const normalizedRow = {};
                for (const originalKey in row) {
                    const normalizedKey = originalKey.trim().toLowerCase();
                    normalizedRow[normalizedKey] = row[originalKey];
                }

                for (const fileHeader in headerMap) {
                    if (normalizedRow[fileHeader] !== undefined) {
                        const dbColumn = headerMap[fileHeader];
                        newRow[dbColumn] = normalizedRow[fileHeader];
                    }
                }

                // *** INÍCIO DA CORREÇÃO DEFINITIVA ***
                // Validação robusta para a coluna 'pedidos'
                const pedidoValue = newRow.pedidos;
                if (pedidoValue === null || pedidoValue === undefined || isNaN(parseInt(pedidoValue, 10))) {
                    newRow.pedidos = null; // Envia nulo se não for um número válido
                } else {
                    newRow.pedidos = parseInt(pedidoValue, 10);
                }
                // *** FIM DA CORREÇÃO DEFINITIVA ***

                if (newRow.data_completa) {
                    const [dataPart, timePart] = String(newRow.data_completa).split(' ');
                    const [dia, mes, ano] = dataPart.split('/');
                    
                    if(dia && mes && ano && timePart) {
                        newRow['dia'] = `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
                        newRow['hora'] = `${timePart}:00`; 
                    } else {
                        console.warn(`[Importação] Linha ${index + 2}: Formato de data inválido. Valor: '${newRow.data_completa}'`);
                        newRow['dia'] = null;
                        newRow['hora'] = null;
                    }
                    delete newRow.data_completa;
                }

                tempPedidoId = newRow['pedido_id'];
                
                if (tempPedidoId) {
                    newRow['row_key'] = `${tempPedidoId}-${newRow.dia}-${index}`;
                } else {
                    newRow['row_key'] = `import-${new Date().getTime()}-${index}`;
                }

                newRow.fat = parseFloat(String(newRow.fat || 0).replace(',', '.')) || 0;
                newRow.des = parseFloat(String(newRow.des || 0).replace(',', '.')) || 0;
                newRow.fre = parseFloat(String(newRow.fre || 0).replace(',', '.')) || 0;

                return newRow;
            });

            if(transformedJson.length === 0){
                throw new Error("Nenhum registro válido foi processado. Verifique o arquivo.");
            }

            setStatus(`Enviando ${transformedJson.length} registros...`, 'info');
            
            const { error } = await supa.from(DEST_INSERT_TABLE).insert(transformedJson);

            if (error) {
                console.error("Erro detalhado do Supabase:", error);
                throw new Error(`O banco de dados retornou um erro: ${error.message}. Detalhes: ${error.details}`);
            }
            
            setStatus('Importação concluída! Atualizando...', 'ok');
            document.dispatchEvent(new Event('filters:apply:internal'));
            
        } catch(e) {
            console.error("Erro na importação:", e);
            let userMessage = e.message || 'Erro desconhecido.';
            if (e.details) userMessage += ` (${e.details})`;
            setStatus(`Erro: ${userMessage}`, 'err');
        } finally {
            $('fileExcel').value='';
        }
    });

    // ===================================================================================
    // LÓGICA DA INTERFACE DE FILTROS
    // ===================================================================================

    function mergeRankedAll(rankedList, allList){
      const rset = new Set(rankedList);
      const rest = allList.filter(x=>!rset.has(x));
      return [...rankedList, ...rest];
    }
    async function reloadStaticOptions(){
      const de = firstDay || '1900-01-01';
      const ate= lastDay  || DateHelpers.iso(new Date());
      const TOPN = 50;
      const [topUnids, topLojas, topPags, topCanais] = await Promise.allSettled([
        supa.rpc('opt_unidades_ranked',  { p_dini: de, p_dfim: ate, p_lojas:null, p_turnos:null, p_canais:null, p_pags:null, p_cancelado:null, p_limit: TOPN }),
        supa.rpc('opt_lojas_ranked',     { p_dini: de, p_dfim: ate, p_unids:null, p_turnos:null, p_canais:null, p_pags:null, p_cancelado:null, p_limit: TOPN }),
        supa.rpc('opt_pagamentos_ranked',{ p_dini: de, p_dfim: ate, p_unids:null, p_turnos:null, p_canais:null, p_lojas:null, p_cancelado:null, p_limit: TOPN }),
        supa.rpc('opt_canais_ranked',    { p_dini: de, p_dfim: ate, p_unids:null, p_turnos:null, p_lojas:null, p_pags:null, p_cancelado:null, p_limit: TOPN }),
      ]);
      const tUnids = (topUnids.status==='fulfilled' && !topUnids.value.error) ? (topUnids.value.data||[]).map(r=>r.unidade).filter(Boolean) : [];
      const tLojas = (topLojas.status==='fulfilled'  && !topLojas.value.error)  ? (topLojas.value.data||[]).map(r=>r.loja).filter(Boolean)       : [];
      const tPags  = (topPags.status==='fulfilled'   && !topPags.value.error)   ? (topPags.value.data||[]).map(r=>r.pagamento_base).filter(Boolean): [];
      const tCanais= (topCanais.status==='fulfilled' && !topCanais.value.error) ? (topCanais.value.data||[]).map(r=>r.canal).filter(Boolean)      : [];
      const [unids,lojas,canais,pags] = await Promise.allSettled([
        supa.from('vw_vendas_unidades').select('unidade').order('unidade'),
        supa.from('vw_vendas_lojas').select('loja').order('loja'),
        supa.from('vw_vendas_canais').select('canal').order('canal'),
        supa.from('vw_vendas_pagamentos').select('pagamento_base').order('pagamento_base'),
      ]);
      const ok = (r)=> r.status==='fulfilled' && !r.value.error && Array.isArray(r.value.data);
      const allUnids = ok(unids) ? (unids.value.data||[]).map(r=>r.unidade).filter(Boolean) : [];
      const allLojas = ok(lojas) ? (lojas.value.data||[]).map(r=>r.loja).filter(Boolean) : [];
      const allCanais= ok(canais)? (canais.value.data||[]).map(r=>r.canal).filter(Boolean): [];
      const allPags  = ok(pags)  ? (pags.value.data||[]).map(r=>r.pagamento_base).filter(Boolean) : [];
      ms.unids.setOptions( mergeRankedAll(tUnids, allUnids), true );
      ms.lojas.setOptions( mergeRankedAll(tLojas, allLojas), true );
      ms.canais.setOptions(mergeRankedAll(tCanais, allCanais), true );
      ms.pags.setOptions(  mergeRankedAll(tPags, allPags), true );
      ms.turnos.setOptions(['Dia','Noite'], true);
    }
    
    async function applyAll(details){
      try{
        const de = details.start;
        const ate = details.end;
        const analiticos = details.analiticos;
        if (!de || !ate) {
            setStatus('Selecione um período', 'err');
            return;
        }
        
        const {dePrev, atePrev} = DateHelpers.computePrevRangeISO(de,ate);
        setStatus('Consultando…');
        
        const totalViewAnaliticos = { ...analiticos, unidade: [], loja: [] };
        
        const kpiData = await updateKPIs(de, ate, dePrev, atePrev, totalViewAnaliticos);
        renderVendasKPIs(kpiData);

        const selectedKpiForDiag = $('kpi-select').value;
        await Promise.all([
          updateMonth12x12(totalViewAnaliticos),
          getAndRenderUnitKPIs(selectedKpiForDiag, de, ate, dePrev, atePrev, analiticos),
          updateCharts(de,ate,dePrev,atePrev, analiticos),
          updateDiagnosticCharts(de, ate, analiticos),
          updateTop6(de,ate, analiticos),
          updateInsights(de, ate, analiticos, selectedKpiForDiag),
          updateProjections(de, ate, dePrev, atePrev, analiticos)
        ]);
        
        setStatus('OK','ok');
        matchPanelHeights();
      }catch(e){
        console.error('Erro em applyAll:', e);
        setStatus('Erro: '+(e.message||e),'err');
      }
    }

    const tabsContainer = $('tabs');
    if (tabsContainer) {
      tabsContainer.addEventListener('click', (e)=>{
        const btn=e.target.closest('button'); if(!btn) return;
        document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active', b===btn));
        document.querySelectorAll('.tab').forEach(t=> t.style.display = (t.id==='tab-'+btn.dataset.tab)?'block':'none');
      });
    }

    function fxLocalMidday(d){ const x=new Date(d); x.setHours(12,0,0,0); return x }
    function fxFmt(date){ return date.toISOString().slice(0,10); }
    function fxSetRange(start,end){ fx.$start.value = fxFmt(start); fx.$end.value = fxFmt(end) }
    function fxLastNDays(n){
      const baseDate = lastDay ? fxLocalMidday(lastDay) : new Date();
      const end = new Date(baseDate);
      const start = new Date(baseDate);
      start.setDate(baseDate.getDate()-(n-1));
      fxSetRange(start,end);
    }
    function fxNamed(win){
      const baseDate = lastDay ? fxLocalMidday(lastDay) : new Date();
      if(win==='today'){ fxSetRange(baseDate,baseDate) }
      else if(win==='yesterday'){ const y=new Date(baseDate); y.setDate(baseDate.getDate()-1); fxSetRange(y,y) }
      else if(win==='lastMonth'){ const y=baseDate.getFullYear(), m=baseDate.getMonth(); fxSetRange(new Date(y,m-1,1), new Date(y,m,0)) }
      else if(win==='lastYear'){ const yy=baseDate.getFullYear()-1; fxSetRange(new Date(yy,0,1), new Date(yy,11,31)) }
    }

    const fx = {
      $drop: $('fxDropup'),
      $btnMore: $('fxBtnMore'),
      $btnReset: $('fxBtnReset'),
      $duClose: $('fxDuClose'),
      $start: $('fxDuStart'),
      $end: $('fxDuEnd'),
      $days: $('fxDuQuickDays'),
      $chips: $('fxQuickChips'),
      $segProj: $('segProj'),
    };

    fx.$segProj.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        const days = parseInt(btn.dataset.days, 10);
        if (!isNaN(days)) {
            projectionDays = days;
            fx.$segProj.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
            fxDispatchApply();
        }
    });

    const segDiagCharts = $('segDiagCharts');
    if (segDiagCharts) {
        segDiagCharts.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            diagChartMode = btn.dataset.mode;
            segDiagCharts.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
            fxDispatchApply();
        });
    }

    function fxShowDrop(show){
      fx.$drop.classList.toggle('fx-show', show);
      fx.$btnMore.setAttribute('aria-expanded', show?'true':'false');
      if(show) fx.$start?.focus();
    }
    fx.$btnMore.addEventListener('click', ()=> fxShowDrop(!fx.$drop.classList.contains('fx-show')));
    fx.$duClose.addEventListener('click', ()=> fxShowDrop(false));
    document.addEventListener('click', (e)=>{
      if(!fx.$drop.classList.contains('fx-show')) return;
      if(!(fx.$drop.contains(e.target) || fx.$btnMore.contains(e.target))) fxShowDrop(false);
    });
    document.addEventListener('keydown', (e)=>{ if(e.key==='Escape' && fx.$drop.classList.contains('fx-show')) fxShowDrop(false) });

    function fxDispatchApply(){
      const payload = {
        start: fx.$start.value, 
        end: fx.$end.value,
        analiticos: {
          unidade: ms.unids.get(),
          loja: ms.lojas.get(),
          turno: ms.turnos.get(),
          canal: ms.canais.get(),
          pagamento: ms.pags.get(),
          cancelado: fxCanceled.value
        }
      };
      document.dispatchEvent(new CustomEvent('filters:apply', { detail: payload }));
    }

    fx.$chips.addEventListener('click', (e)=>{
      const b=e.target.closest('.fx-chip'); if(!b) return;
      fx.$chips.querySelectorAll('.fx-chip').forEach(x=> x.classList.toggle('active', x===b));
      fx.$days.querySelectorAll('button').forEach(x=> x.classList.remove('fx-active'));
      fxNamed(b.dataset.win);
      fxDispatchApply();
    });

    fx.$days.addEventListener('click', (e)=>{
      const b=e.target.closest('button'); if(!b) return;
      fx.$days.querySelectorAll('button').forEach(x=> x.classList.toggle('fx-active', x===b));
      fx.$chips.querySelectorAll('.fx-chip').forEach(x=> x.classList.remove('active'));
      const n=parseInt(b.dataset.win,10); if(!isNaN(n)) fxLastNDays(n);
      fxDispatchApply();
    });

    fx.$btnReset.addEventListener('click', ()=>{
      fx.$chips.querySelectorAll('.fx-chip').forEach(x=> x.classList.remove('active'));
      fx.$days.querySelectorAll('button').forEach(x=> x.classList.remove('fx-active'));
      
      Object.values(ms).forEach(m => m.clear());
      fxCanceled.value = 'nao';
      
      fxLastNDays(30);
      fx.$days.querySelector('button[data-win="30"]').classList.add('fx-active');
      fxDispatchApply();
    });

    fx.$start.addEventListener('change', fxDispatchApplyDebounced);
    fx.$end.addEventListener('change', fxDispatchApplyDebounced);
    fxCanceled.addEventListener('change', fxDispatchApplyDebounced);
    $('kpi-select').addEventListener('change', fxDispatchApplyDebounced);

    document.addEventListener('filters:apply', (e) => {
        if(e.detail) {
            applyAll(e.detail);
        }
    });

    document.addEventListener('filters:apply:internal', () => {
        updateChartTitles();
        fxDispatchApply();
    });
    
    /* ===================== INICIALIZAÇÃO ===================== */
    (async function init(){
      try{
        setStatus('Carregando…');
        const dr = await supa.from('vw_vendas_daterange').select('min_dia, max_dia').limit(1);
        if(dr.error) throw dr.error;
        if(dr.data?.length){ 
          firstDay=dr.data[0].min_dia; 
          lastDay=dr.data[0].max_dia; 
        }
        
        await reloadStaticOptions();
        
        bindKPIClick();
        updateChartTitles();

        window.addEventListener('resize', debounce(matchPanelHeights, 150));

        fxLastNDays(30);
        fx.$days.querySelector('button[data-win="30"]').classList.add('fx-active');
        fxDispatchApply();
      }catch(e){
        console.error('Erro na inicialização:', e);
        setStatus('Erro ao iniciar: '+(e.message||e),'err');
      }
    })();

});
