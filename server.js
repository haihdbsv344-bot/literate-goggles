const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

const API_BASE = 'https://solid-computing-machine-uz8r.onrender.com';
const sessionData = {};
const lastData = {};
const predictionHistory = {};

function toArray(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// ============================================================
// 16 METHODS (giữ nguyên logic, chỉ fix scoring)
// ============================================================

function analyzeFrequency(arr) {
    const prior = { B: 45.86, P: 44.62, T: 9.52 };
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) if (counts[c] !== undefined) counts[c]++;
    const total = arr.length;
    const alpha = 20;
    const post = {};
    for (const k of ['B','P','T']) {
        post[k] = (counts[k] + (prior[k] / 100) * alpha) / (total + alpha) * 100;
    }
    return { post, counts, pct: { B: (counts.B/total)*100, P: (counts.P/total)*100, T: (counts.T/total)*100 } };
}

function analyzeStreak(arr) {
    const streaks = [];
    let cur = { char: arr[0], len: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.char) cur.len++;
        else { streaks.push({...cur}); cur = { char: arr[i], len: 1 }; }
    }
    streaks.push({...cur});
    const last = streaks[streaks.length - 1];
    const secondLast = streaks[streaks.length - 2] || null;
    const avgB = streaks.filter(s=>s.char==='B').reduce((a,s)=>a+s.len,0) / (streaks.filter(s=>s.char==='B').length||1);
    const avgP = streaks.filter(s=>s.char==='P').reduce((a,s)=>a+s.len,0) / (streaks.filter(s=>s.char==='P').length||1);
    return { last, secondLast, streaks, avgB, avgP };
}

function analyzeZigzag(arr) {
    function countZZ(a) {
        let zz = 0;
        for (let i = 1; i < a.length - 1; i++) {
            if (a[i]!=='T' && a[i-1]!=='T' && a[i+1]!=='T' && a[i]!==a[i-1] && a[i]!==a[i+1]) zz++;
        }
        return zz;
    }
    const window10 = arr.slice(-10);
    return { zz10: countZZ(window10), zzFull: countZZ(arr), isZZ: countZZ(window10) >= 3 };
}

function analyzePatterns(arr) {
    const runs = [];
    let cur = { char: arr[0], len: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.char) cur.len++;
        else { runs.push({...cur}); cur = { char: arr[i], len: 1 }; }
    }
    runs.push({...cur});
    const rLen = runs.map(r=>r.len);
    const rChar = runs.map(r=>r.char);
    const n = rLen.length;
    const is22 = n>=2 && rLen[n-1]===2 && rLen[n-2]===2 && rChar[n-1]!==rChar[n-2];
    const is33 = n>=2 && rLen[n-1]===3 && rLen[n-2]===3;
    const is121 = n>=3 && rLen[n-3]===1 && rLen[n-2]===2 && rLen[n-1]===1;
    const is212 = n>=3 && rLen[n-3]===2 && rLen[n-2]===1 && rLen[n-1]===2;
    return { is22, is33, is121, is212, runs, lastRun: runs[n-1], prevRun: runs[n-2]||null };
}

function analyzeMarkov(arr) {
    const m1 = { B:{B:0,P:0,T:0}, P:{B:0,P:0,T:0}, T:{B:0,P:0,T:0} };
    for (let i = 0; i < arr.length-1; i++) {
        if (m1[arr[i]]) m1[arr[i]][arr[i+1]]++;
    }
    const m2 = {};
    for (let i = 0; i < arr.length-2; i++) {
        const key = arr[i]+arr[i+1];
        if (!m2[key]) m2[key] = {B:0,P:0,T:0};
        m2[key][arr[i+2]]++;
    }
    function bestOf(trans) {
        const total = Object.values(trans).reduce((a,b)=>a+b,0);
        if (!total) return { pred:'B', prob:0 };
        let best='B', bestP=0;
        for (const [k,v] of Object.entries(trans)) {
            if (v/total > bestP) { bestP=v/total; best=k; }
        }
        return { pred:best, prob:bestP };
    }
    const last1 = arr[arr.length-1];
    const last2 = arr.slice(-2).join('');
    const o1 = bestOf(m1[last1]||{B:1,P:1,T:0});
    const o2 = m2[last2] ? bestOf(m2[last2]) : {pred:'B',prob:0};
    const pred = (arr.length > 30 && o2.prob > 0.35) ? o2 : o1;
    return { o1, o2, pred };
}

function analyzeMomentum(arr) {
    const values = arr.map(c => c==='B'?1 : c==='P'?-1 : 0);
    const alpha = 0.3;
    let ewm = values[0]||0;
    for (let i=1; i<values.length; i++) ewm = alpha*values[i] + (1-alpha)*ewm;
    return { ewm, trend: ewm>0.15?'B' : ewm<-0.15?'P' : 'NEUTRAL' };
}

function analyzeEntropy(arr) {
    const counts = {B:0,P:0,T:0};
    for (const c of arr) if (counts[c]!==undefined) counts[c]++;
    const total = arr.length;
    let entropy = 0;
    for (const c of ['B','P','T']) {
        const p = counts[c]/total;
        if (p>0) entropy -= p*Math.log2(p);
    }
    return { entropy, predictability: 1 - (entropy/Math.log2(3)) };
}

function analyzeWindows(arr) {
    function cw(n) {
        const w = arr.slice(-n);
        return { B:w.filter(c=>c==='B').length, P:w.filter(c=>c==='P').length, T:w.filter(c=>c==='T').length, len:w.length };
    }
    return { w5:cw(5), w10:cw(10), w20:cw(20) };
}

function analyzeTie(arr) {
    const tiePos = arr.reduce((acc,c,i)=>{ if(c==='T') acc.push(i); return acc; },[]);
    if (tiePos.length < 2) return { signal:false, freq:(tiePos.length/arr.length)*100, avgGap:Infinity, gapScore:0, lastGap:0 };
    const gaps = [];
    for (let i=1; i<tiePos.length; i++) gaps.push(tiePos[i]-tiePos[i-1]);
    const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    const lastGap = arr.length-1-tiePos[tiePos.length-1];
    const freq = (tiePos.length/arr.length)*100;
    const gapScore = clamp(lastGap/avgGap, 0, 3);
    const signal = (gapScore>=0.85 && freq>7) || freq>13;
    return { signal, freq, avgGap, lastGap, gapScore };
}

function analyzeMeanReversion(arr) {
    const freq = analyzeFrequency(arr);
    const pct = freq.pct;
    const bDev = pct.B - 45.86;
    const pDev = pct.P - 44.62;
    return { bDev, pDev, revertTo: bDev>8?'P' : pDev>8?'B' : 'NEUTRAL', strength: Math.max(Math.abs(bDev), Math.abs(pDev)) };
}

function analyzeRegime(arr) {
    const recent = arr.slice(-20);
    let switches = 0;
    for (let i=1; i<recent.length; i++) {
        if (recent[i]!==recent[i-1] && recent[i]!=='T' && recent[i-1]!=='T') switches++;
    }
    const switchRate = switches/(recent.length-1||1);
    return { switchRate, regime: switchRate>0.6?'CHOP' : switchRate<0.35?'STREAK' : 'MIXED' };
}

function analyzeAutoCorr(arr) {
    const vals = arr.map(c=>c==='B'?1:c==='P'?-1:0);
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    let num=0, den=0;
    for (let i=0; i<vals.length-1; i++) num += (vals[i]-mean)*(vals[i+1]-mean);
    for (let i=0; i<vals.length; i++) den += (vals[i]-mean)**2;
    const acf = den===0?0:num/den;
    return { acf, type: acf>0.1?'TREND' : acf<-0.1?'REVERT' : 'RANDOM' };
}

function analyzeSessionFatigue(tableId) {
    if (!predictionHistory[tableId]) predictionHistory[tableId] = [];
    const hist = predictionHistory[tableId];
    if (hist.length < 5) return { boost: {B:0,P:0,T:0} };
    const r = hist.slice(-5);
    const bC = r.filter(p=>p==='B').length;
    const pC = r.filter(p=>p==='P').length;
    const boost = {B:0,P:0,T:0};
    if (bC>=4) boost.P += 6;
    else if (pC>=4) boost.B += 6;
    return { boost };
}

function analyzeHotCold(arr) {
    const recent = arr.slice(-15);
    const rcB = recent.filter(c=>c==='B').length/recent.length;
    const fullB = arr.filter(c=>c==='B').length/arr.length;
    const rcP = recent.filter(c=>c==='P').length/recent.length;
    const fullP = arr.filter(c=>c==='P').length/arr.length;
    const bHot = rcB - fullB;
    const pHot = rcP - fullP;
    return { bHot, pHot, coolDown: bHot>0.15?'P' : pHot>0.15?'B' : 'NEUTRAL' };
}

function analyzePatternCompletion(arr) {
    if (arr.length < 12) return { match:false, predicted:null, confidence:0 };
    const recent6 = arr.slice(-6).join('');
    const searchIn = arr.slice(0,-6).join('');
    for (let partial=5; partial>=3; partial--) {
        const partialSeq = recent6.substring(0, partial);
        const idx = searchIn.lastIndexOf(partialSeq);
        if (idx !== -1 && idx+partial < arr.length-6) {
            return { match:true, predicted:arr[idx+partial], confidence:partial/6 };
        }
    }
    return { match:false, predicted:null, confidence:0 };
}

function analyzeVolatility(arr) {
    const window = arr.slice(-20);
    let changes = 0;
    for (let i=1; i<window.length; i++) {
        if (window[i]!==window[i-1]) changes++;
    }
    const vol = changes/(window.length-1||1);
    return { vol, isHigh:vol>0.65, isLow:vol<0.35 };
}

// ============================================================
// ENSEMBLE PREDICTOR — FIXED SCORING
// ============================================================
function predictBCR(history, tableId='UNKNOWN') {
    if (!history || history.length < 3) {
        return {
            prediction:'Player', bankerRate:46, playerRate:46, tieRate:8,
            pattern:'Chưa đủ dữ liệu', cau_goc:history||'',
            confidence:50, stats:{B:0,P:0,T:0}
        };
    }

    const arr = toArray(history);
    if (arr.length < 3) {
        return {
            prediction:'Player', bankerRate:46, playerRate:46, tieRate:8,
            pattern:'Chưa đủ dữ liệu', cau_goc:history||'',
            confidence:50, stats:{B:0,P:0,T:0}
        };
    }

    const freq    = analyzeFrequency(arr);
    const streak  = analyzeStreak(arr);
    const zigzag  = analyzeZigzag(arr);
    const patt    = analyzePatterns(arr);
    const markov  = analyzeMarkov(arr);
    const mom     = analyzeMomentum(arr);
    const ent     = analyzeEntropy(arr);
    const wins    = analyzeWindows(arr);
    const tie     = analyzeTie(arr);
    const mrev    = analyzeMeanReversion(arr);
    const regime  = analyzeRegime(arr);
    const acf     = analyzeAutoCorr(arr);
    const fatigue = analyzeSessionFatigue(tableId);
    const hotcold = analyzeHotCold(arr);
    const patcomp = analyzePatternCompletion(arr);
    const vol     = analyzeVolatility(arr);

    // ── Score accumulator ──
    // Format: setiap method ngủ contribute vote {B, P, T} dalam range 0–1
    // Tao accumulate votes, lấy weighted average, KHÔNG clamp keras
    const votes = [];

    // FIX UTAMA: mỗi method đóng góp vote {b, p, t} + weight
    // vote phải sum = 1 per method
    // weight = importance của method

    const lastNT = [...arr].reverse().find(c=>c!=='T') || 'B';

    // 1. BAYESIAN FREQUENCY — weight 1.0
    {
        const tot = freq.post.B + freq.post.P + freq.post.T;
        votes.push({ b:freq.post.B/tot, p:freq.post.P/tot, t:freq.post.T/tot, w:1.0 });
    }

    // 2. STREAK — weight 1.8
    {
        const sl = streak.last;
        let b=0.46, p=0.44, t=0.10;
        if (sl.char !== 'T') {
            // Probability of continuing decreases with streak length
            // Based on empirical baccarat: ~50% chance of continuation at len 1
            // drops ~5% per additional card
            const continueP = clamp(0.52 - (sl.len-1)*0.06, 0.25, 0.65);
            const reverseP = 1 - continueP;
            if (sl.char==='B') { b=continueP; p=reverseP; t=0.02; }
            else               { p=continueP; b=reverseP; t=0.02; }
            // normalize
            const s = b+p+t; b/=s; p/=s; t/=s;
        }
        votes.push({ b, p, t, w:1.8 });
    }

    // 3. ZIGZAG — weight 1.4
    {
        let b=0.46, p=0.44, t=0.10;
        if (zigzag.isZZ) {
            // Chop → flip
            if (lastNT==='B') { b=0.25; p=0.70; t=0.05; }
            else              { b=0.70; p=0.25; t=0.05; }
        }
        votes.push({ b, p, t, w:1.4 });
    }

    // 4. PATTERNS — weight 1.6
    {
        let b=0.46, p=0.44, t=0.10;
        const pLastChar = patt.lastRun?.char;
        const pPrevChar = patt.prevRun?.char;
        if (patt.is22 && pPrevChar) {
            // 2-2: next pair matches prev char
            if (pPrevChar==='B') { b=0.72; p=0.24; t=0.04; }
            else                 { b=0.24; p=0.72; t=0.04; }
        } else if (patt.is33 && pLastChar) {
            // 3-3: break
            if (pLastChar==='B') { b=0.26; p=0.70; t=0.04; }
            else                 { b=0.70; p=0.26; t=0.04; }
        } else if (patt.is121 && pLastChar) {
            if (pLastChar==='B') { b=0.62; p=0.34; t=0.04; }
            else                 { b=0.34; p=0.62; t=0.04; }
        } else if (patt.is212 && pLastChar) {
            if (pLastChar==='B') { b=0.60; p=0.36; t=0.04; }
            else                 { b=0.36; p=0.60; t=0.04; }
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.6 });
    }

    // 5. MARKOV O1+O2 — weight 1.8
    {
        const mkP = markov.pred;
        let b=0.46, p=0.44, t=0.10;
        if (mkP.prob > 0.3) {
            const conf = clamp(mkP.prob, 0.35, 0.75);
            const rest = (1 - conf);
            if (mkP.pred==='B') { b=conf; p=rest*0.85; t=rest*0.15; }
            else if (mkP.pred==='P') { p=conf; b=rest*0.85; t=rest*0.15; }
            else { t=conf; b=rest*0.85; p=rest*0.15; }
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.8 });
    }

    // 6. EWM MOMENTUM — weight 1.2
    {
        let b=0.46, p=0.44, t=0.10;
        const strength = clamp(Math.abs(mom.ewm), 0, 1);
        if (mom.trend==='B') { b=0.46+strength*0.18; p=0.44-strength*0.18; }
        else if (mom.trend==='P') { p=0.44+strength*0.18; b=0.46-strength*0.18; }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.2 });
    }

    // 7. ENTROPY — weight 0.9
    {
        let b=0.46, p=0.44, t=0.10;
        if (ent.predictability > 0.55) {
            const dominant = freq.pct.B > freq.pct.P ? 'B' : 'P';
            const boost = ent.predictability * 0.2;
            if (dominant==='B') { b=0.46+boost; p=0.44-boost; }
            else                { p=0.44+boost; b=0.46-boost; }
        } else if (ent.predictability < 0.2) {
            t=0.20; b=0.43; p=0.37;
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:0.9 });
    }

    // 8. MULTI-WINDOW — weight 1.5
    {
        const wB = (wins.w5.B/wins.w5.len)*0.5 + (wins.w10.B/wins.w10.len)*0.3 + (wins.w20.B/wins.w20.len)*0.2;
        const wP = (wins.w5.P/wins.w5.len)*0.5 + (wins.w10.P/wins.w10.len)*0.3 + (wins.w20.P/wins.w20.len)*0.2;
        const wT = (wins.w5.T/wins.w5.len)*0.5 + (wins.w10.T/wins.w10.len)*0.3 + (wins.w20.T/wins.w20.len)*0.2;
        const s = wB+wP+wT||1;
        votes.push({ b:wB/s, p:wP/s, t:wT/s, w:1.5 });
    }

    // 9. TIE SIGNAL — weight 1.2
    {
        let b=0.46, p=0.44, t=0.10;
        if (tie.signal) {
            const tieBoost = clamp(tie.gapScore * 0.15, 0.05, 0.30);
            t = 0.10 + tieBoost;
            const rem = 1 - t;
            b = rem * 0.51; p = rem * 0.49;
        }
        votes.push({ b, p, t, w:1.2 });
    }

    // 10. MEAN REVERSION — weight 1.3
    {
        let b=0.46, p=0.44, t=0.10;
        if (mrev.revertTo !== 'NEUTRAL') {
            const strength = clamp(mrev.strength / 20, 0.05, 0.25);
            if (mrev.revertTo==='B') { b=0.46+strength; p=0.44-strength; }
            else                     { p=0.44+strength; b=0.46-strength; }
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.3 });
    }

    // 11. REGIME — weight 1.5
    {
        let b=0.46, p=0.44, t=0.10;
        const str = clamp(Math.abs(regime.switchRate - 0.5) * 2, 0, 0.35);
        if (regime.regime==='CHOP') {
            if (lastNT==='B') { b=0.46-str*0.5; p=0.44+str*0.5; }
            else              { p=0.44-str*0.5; b=0.46+str*0.5; }
        } else if (regime.regime==='STREAK') {
            if (lastNT==='B') { b=0.46+str*0.5; p=0.44-str*0.5; }
            else              { p=0.44+str*0.5; b=0.46-str*0.5; }
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.5 });
    }

    // 12. AUTOCORRELATION — weight 1.1
    {
        let b=0.46, p=0.44, t=0.10;
        const acfStr = clamp(Math.abs(acf.acf), 0, 0.8);
        if (acf.type==='TREND') {
            if (lastNT==='B') { b=0.46+acfStr*0.2; p=0.44-acfStr*0.2; }
            else              { p=0.44+acfStr*0.2; b=0.46-acfStr*0.2; }
        } else if (acf.type==='REVERT') {
            if (lastNT==='B') { b=0.46-acfStr*0.2; p=0.44+acfStr*0.2; }
            else              { p=0.44-acfStr*0.2; b=0.46+acfStr*0.2; }
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.1 });
    }

    // 13. SESSION FATIGUE — weight 0.7 (minor correction)
    {
        let b=0.46+fatigue.boost.B/100, p=0.44+fatigue.boost.P/100, t=0.10;
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:0.7 });
    }

    // 14. HOT/COLD — weight 1.1
    {
        let b=0.46, p=0.44, t=0.10;
        const hcStr = clamp(Math.max(Math.abs(hotcold.bHot), Math.abs(hotcold.pHot)) * 2, 0, 0.28);
        if (hotcold.coolDown==='B') { b=0.46+hcStr; p=0.44-hcStr; }
        else if (hotcold.coolDown==='P') { p=0.44+hcStr; b=0.46-hcStr; }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.1 });
    }

    // 15. PATTERN COMPLETION — weight 1.4
    {
        let b=0.46, p=0.44, t=0.10;
        if (patcomp.match && patcomp.predicted) {
            const conf = clamp(patcomp.confidence, 0.3, 0.7);
            const rest = 1 - conf;
            if (patcomp.predicted==='B')      { b=conf; p=rest*0.85; t=rest*0.15; }
            else if (patcomp.predicted==='P') { p=conf; b=rest*0.85; t=rest*0.15; }
            else                              { t=conf; b=rest*0.52; p=rest*0.48; }
        }
        const s=b+p+t; votes.push({ b:b/s, p:p/s, t:t/s, w:1.4 });
    }

    // 16. VOLATILITY INDEX — weight 1.0
    {
        let b=0.46, p=0.44, t=0.10;
        if (vol.isHigh) {
            // High vol → trust frequency
            const tot = freq.post.B+freq.post.P+freq.post.T;
            b=freq.post.B/tot; p=freq.post.P/tot; t=freq.post.T/tot;
        }
        // Low vol: leave at baseline (patterns already captured)
        votes.push({ b, p, t, w:1.0 });
    }

    // ── WEIGHTED AVERAGE ──
    let totalW = 0, sumB = 0, sumP = 0, sumT = 0;
    for (const v of votes) {
        sumB += v.b * v.w;
        sumP += v.p * v.w;
        sumT += v.t * v.w;
        totalW += v.w;
    }
    let bRate = (sumB / totalW) * 100;
    let pRate = (sumP / totalW) * 100;
    let tRate = (sumT / totalW) * 100;

    // ── SOFT NORMALIZATION (không clamp cứng) ──
    // Chỉ đảm bảo sum = 100 và min reasonable
    const rawSum = bRate + pRate + tRate;
    bRate = (bRate / rawSum) * 100;
    pRate = (pRate / rawSum) * 100;
    tRate = (tRate / rawSum) * 100;

    // Floor nhẹ thôi, không làm mất spread
    bRate = Math.max(bRate, 5);
    pRate = Math.max(pRate, 5);
    tRate = Math.max(tRate, 3);

    // Re-normalize after floor
    const floorSum = bRate + pRate + tRate;
    bRate = (bRate / floorSum) * 100;
    pRate = (pRate / floorSum) * 100;
    tRate = (tRate / floorSum) * 100;

    // ── PREDICTION ──
    let prediction;
    if (tie.signal && tRate > 20 && tRate > Math.min(bRate, pRate) * 0.9) {
        prediction = 'Tie';
    } else if (bRate >= pRate) {
        prediction = 'Banker';
    } else {
        prediction = 'Player';
    }

    // ── ROUND ──
    let b = Math.round(bRate);
    let p = Math.round(pRate);
    let t = Math.round(tRate);
    const rSum = b+p+t;
    if (rSum !== 100) {
        const diff = 100 - rSum;
        if (b >= p && b >= t) b += diff;
        else if (p >= b && p >= t) p += diff;
        else t += diff;
    }

    // ── CONFIDENCE ──
    // Confidence = độ chắc chắn = khoảng cách giữa bên dẫn đầu và bên thứ 2
    const top = Math.max(b, p);
    const second = [b, p, t].sort((a,b)=>b-a)[1];
    const spread = top - second;
    // Spread 5 = conf 55, spread 15 = conf 70, spread 25 = conf 85
    let confidence = clamp(50 + spread * 1.5 + ent.predictability * 8, 50, 88);
    if (patcomp.match) confidence = clamp(confidence + 3, 50, 88);
    confidence = Math.round(confidence);

    // ── PATTERN LABEL ──
    let pattern = 'Cầu đan xen';
    if (prediction==='Tie' && tie.signal) {
        pattern = `🔮 TIE SIGNAL! Gap=${Math.round(tie.avgGap||0)}, Freq=${Math.round(tie.freq)}%, Score=${Math.round(tie.gapScore*100)}%`;
    } else if (regime.regime==='CHOP') {
        pattern = `Chop Regime (${Math.round(regime.switchRate*100)}% switches) → Đảo chiều`;
    } else if (regime.regime==='STREAK') {
        pattern = `Streak Regime — ${streak.last.char}x${streak.last.len} → Tiếp tục`;
    } else if (patt.is22) { pattern = `Cầu 2-2 đang hoạt động`; }
    else if (patt.is33)   { pattern = `Cầu 3-3`; }
    else if (patt.is121)  { pattern = `Cầu 1-2-1`; }
    else if (patt.is212)  { pattern = `Cầu 2-1-2`; }
    else if (zigzag.isZZ) { pattern = `Zigzag (10 ván: ${zigzag.zz10} lần đổi)`; }
    else if (patcomp.match) { pattern = `Pattern Completion (conf=${Math.round(patcomp.confidence*100)}%)`; }
    else if (mrev.revertTo!=='NEUTRAL') { pattern = `Mean Reversion → ${mrev.revertTo} (dev=${Math.round(mrev.strength)}%)`; }
    else { pattern = `ACF:${acf.type} | Mom:${mom.trend} | Vol:${Math.round(vol.vol*100)}%`; }

    // ── STORE SESSION ──
    if (!predictionHistory[tableId]) predictionHistory[tableId] = [];
    predictionHistory[tableId].push(prediction[0]);
    if (predictionHistory[tableId].length > 20) predictionHistory[tableId].shift();

    return {
        prediction, bankerRate:Math.max(b,4), playerRate:Math.max(p,4), tieRate:Math.max(t,2),
        pattern, cau_goc:history, confidence,
        tie_signal:tie.signal, tie_score:Math.round(tie.freq),
        stats: {
            B:Math.round(freq.pct.B), P:Math.round(freq.pct.P), T:Math.round(freq.pct.T),
            regime:regime.regime, acf:acf.type, momentum:mom.trend,
            streak:`${streak.last.char}x${streak.last.len}`,
            zigzag:zigzag.zz10, pattern22:patt.is22, pattern33:patt.is33,
            patternCompletion:patcomp.match, hotSide:hotcold.hotSide,
            meanRevert:mrev.revertTo, volatility:Math.round(vol.vol*100),
            entropy:Math.round(ent.entropy*10)/10,
            predictability:Math.round(ent.predictability*100),
            tieGap:Math.round(tie.avgGap||0), tieFreq:Math.round(tie.freq),
            spread:spread
        }
    };
}

// ============================================================
// API ROUTES
// ============================================================
async function fetchTableData(tableId) {
    try {
        const url = `${API_BASE}/api/baccarat/${tableId.toUpperCase()}`;
        console.log(`📡 Gọi API: ${url}`);
        const response = await axios.get(url, { timeout: 15000 });
        if (response.data?.success && response.data?.data) return response.data.data.result || '';
        return '';
    } catch (error) {
        console.error(`❌ Lỗi bàn ${tableId}:`, error.message);
        return '';
    }
}

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) return res.json({ success:false, message:`Không tìm thấy bàn ${tableId}` });

        const oldData = lastData[tableId]||'';
        const isNewData = cauGoc!==oldData && cauGoc.length>oldData.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId]=0;
        if (isNewData) sessionData[tableId]++;

        const result = predictBCR(cauGoc, tableId);

        res.json({
            success:true,
            bàn:`Bàn ${tableId}`,
            phiên:sessionData[tableId],
            cầu_gốc:cauGoc,
            dự_đoán:result.prediction,
            banker_rate:`${result.bankerRate}%`,
            player_rate:`${result.playerRate}%`,
            tie_rate:`${result.tieRate}%`,
            dự_đoán_tie:result.tie_signal?'CÓ':'KHÔNG',
            cầu:result.pattern,
            confidence:`${result.confidence}%`,
            spread:`${result.stats.spread}%`,
            stats:result.stats,
            engine:'v15.1.0-FIXED',
            id:'@tranhoang2286'
        });
    } catch(error) {
        res.status(500).json({ success:false, error:error.message });
    }
});

app.get('/api/predict/all', async (req, res) => {
    try {
        const tableIds = ['C01','C02','C04','C05','C06','C07','C08','C09','C10','C11','C15','C16','C17','C18','C19','C20'];
        const results = [];
        for (const id of tableIds) {
            const cauGoc = await fetchTableData(id);
            if (!cauGoc) continue;
            const oldData = lastData[id]||'';
            const isNewData = cauGoc!==oldData && cauGoc.length>oldData.length;
            lastData[id] = cauGoc;
            if (!sessionData[id]) sessionData[id]=0;
            if (isNewData) sessionData[id]++;
            const result = predictBCR(cauGoc, id);
            results.push({
                bàn:`Bàn ${id}`,
                phiên:sessionData[id],
                cầu_gốc:cauGoc,
                dự_đoán:result.prediction,
                banker_rate:`${result.bankerRate}%`,
                player_rate:`${result.playerRate}%`,
                tie_rate:`${result.tieRate}%`,
                dự_đoán_tie:result.tie_signal?'CÓ':'KHÔNG',
                cầu:result.pattern,
                confidence:`${result.confidence}%`,
                spread:`${result.stats.spread}%`,
                regime:result.stats.regime
            });
        }
        res.json({ success:true, data:results, total:results.length, engine:'v15.1.0-FIXED', id:'@tranhoang2286' });
    } catch(error) {
        res.status(500).json({ success:false, error:error.message });
    }
});

app.get('/api/baccarat/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const result = await fetchTableData(tableId);
        if (result) res.json({ success:true, data:{ table:tableId, result, shoeId:'', round:'' } });
        else res.json({ success:false, message:`Không tìm thấy bàn ${tableId}` });
    } catch(error) {
        res.status(500).json({ success:false, error:error.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        name:'BACCARAT PREDICTION ULTRA',
        version:'15.1.0-FIXED',
        author:'@tranhoang2286',
        fix:'Bỏ hard-clamp, dùng weighted vote system, spread tự nhiên',
        endpoints:{
            'Dự đoán 1 bàn':'/api/predict/:tableId',
            'Dự đoán tất cả':'/api/predict/all',
            'Lấy dữ liệu bàn':'/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════');
    console.log('🃏 BACCARAT PREDICTION — v15.1.0 FIXED');
    console.log('══════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('🔧 FIX: Weighted vote system, no hard-clamp');
    console.log('📌 16 methods, dynamic spread');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════');
});
