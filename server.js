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
const predHistory = {};

// ============================================================
// UTILS
// ============================================================
function toArr(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function mean(arr) { return arr.length ? sum(arr) / arr.length : 0; }

// ============================================================
// 20 MODULES
// ============================================================

// M01: BAYESIAN FREQUENCY
function m01_bayesFreq(arr) {
    const prior = { B: 45.86, P: 44.62, T: 9.52 };
    const cnt = { B: 0, P: 0, T: 0 };
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const N = arr.length, a = 30;
    const post = {};
    for (const k of ['B','P','T'])
        post[k] = (cnt[k] + (prior[k]/100)*a) / (N + a);
    return { vote: post, weight: 1.2 };
}

// M02: STREAK DYNAMICS
function m02_streak(arr) {
    const runs = [];
    let cur = { c: arr[0], n: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.c) cur.n++;
        else { runs.push({...cur}); cur = { c: arr[i], n: 1 }; }
    }
    runs.push({...cur});
    const last = runs[runs.length - 1];

    const contTable = { 1: 0.507, 2: 0.487, 3: 0.461, 4: 0.432, 5: 0.398 };
    const contP = contTable[Math.min(last.n, 5)] || 0.38;
    const revP  = (1 - contP) * 0.97;
    const tieP  = (1 - contP) * 0.03;

    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    if (last.c === 'B') { vote = { B: contP, P: revP, T: tieP }; }
    else if (last.c === 'P') { vote = { B: revP, P: contP, T: tieP }; }
    else { vote = { B: 0.46, P: 0.44, T: 0.10 }; }

    return { vote, weight: 2.0, meta: { streak: `${last.c}x${last.n}`, contP } };
}

// M03: ZIGZAG WINDOWED
function m03_zigzag(arr) {
    function zzRate(a) {
        let zz = 0;
        for (let i = 1; i < a.length - 1; i++) {
            if (a[i] !== 'T' && a[i-1] !== 'T' && a[i+1] !== 'T'
                && a[i] !== a[i-1] && a[i] !== a[i+1]) zz++;
        }
        return zz / (a.length - 2 || 1);
    }
    const zz10 = zzRate(arr.slice(-10));
    const zz20 = zzRate(arr.slice(-20));
    const zzScore = zz10 * 0.7 + zz20 * 0.3;
    const lastNT = [...arr].reverse().find(c => c !== 'T') || 'B';

    let vote = { B: 0.46, P: 0.44, T: 0.10 };
    if (zzScore > 0.55) {
        const flipStr = zzScore * 0.5;
        if (lastNT === 'B') vote = { B: 0.46 - flipStr, P: 0.44 + flipStr, T: 0.10 };
        else                vote = { B: 0.46 + flipStr, P: 0.44 - flipStr, T: 0.10 };
    }
    const s = vote.B + vote.P + vote.T;
    return { vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, weight: 1.6, meta: { zzScore } };
}

// M04: MULTI-PATTERN
function m04_patterns(arr) {
    const runs = [];
    let cur = { c: arr[0], n: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.c) cur.n++;
        else { runs.push({...cur}); cur = { c: arr[i], n: 1 }; }
    }
    runs.push({...cur});
    const R = runs;
    const L = R.length;
    const rn = R.map(r => r.n);
    const rc = R.map(r => r.c);

    let matchedPatt = 'NONE';
    let vote = { B: 0.46, P: 0.44, T: 0.10 };

    if (L >= 3 && rn[L-1]===2 && rn[L-2]===2 && rn[L-3]===2) {
        matchedPatt = '2-2-2';
        const target = rc[L-3];
        if (target==='B') vote = { B: 0.72, P: 0.24, T: 0.04 };
        else              vote = { B: 0.24, P: 0.72, T: 0.04 };
    }
    else if (L >= 2 && rn[L-1]===2 && rn[L-2]===2 && rc[L-1]!==rc[L-2]) {
        matchedPatt = '2-2';
        const target = rc[L-2];
        if (target==='B') vote = { B: 0.68, P: 0.28, T: 0.04 };
        else              vote = { B: 0.28, P: 0.68, T: 0.04 };
    }
    else if (L >= 2 && rn[L-1]===3 && rn[L-2]===3) {
        matchedPatt = '3-3';
        const brk = rc[L-1]==='B' ? 'P' : 'B';
        if (brk==='B') vote = { B: 0.70, P: 0.26, T: 0.04 };
        else           vote = { B: 0.26, P: 0.70, T: 0.04 };
    }
    else if (L >= 3 && rn[L-3]===1 && rn[L-2]===2 && rn[L-1]===1) {
        matchedPatt = '1-2-1';
        const target = rc[L-2];
        if (target==='B') vote = { B: 0.65, P: 0.31, T: 0.04 };
        else              vote = { B: 0.31, P: 0.65, T: 0.04 };
    }
    else if (L >= 3 && rn[L-3]===2 && rn[L-2]===1 && rn[L-1]===2) {
        matchedPatt = '2-1-2';
        const flip = rc[L-1]==='B' ? 'P' : 'B';
        if (flip==='B') vote = { B: 0.63, P: 0.33, T: 0.04 };
        else            vote = { B: 0.33, P: 0.63, T: 0.04 };
    }
    else if (L >= 5 && rn.slice(-5).every(n => n===1)) {
        matchedPatt = 'CHOP5';
        const lastC = rc[L-1];
        if (lastC==='B') vote = { B: 0.25, P: 0.68, T: 0.07 };
        else             vote = { B: 0.68, P: 0.25, T: 0.07 };
    }

    const s = vote.B + vote.P + vote.T;
    return { vote: { B: vote.B/s, P: vote.P/s, T: vote.T/s }, weight: 1.8, meta: { pattern: matchedPatt } };
}

// M05: MARKOV ORDER 1+2
function m05_markov(arr) {
    const m1 = { B:{B:0,P:0,T:0}, P:{B:0,P:0,T:0}, T:{B:0,P:0,T:0} };
    for (let i = 0; i < arr.length - 1; i++) {
        if (m1[arr[i]]) m1[arr[i]][arr[i+1]]++;
    }
    const m2 = {};
    for (let i = 0; i < arr.length - 2; i++) {
        const k = arr[i]+arr[i+1];
        if (!m2[k]) m2[k] = {B:0,P:0,T:0};
        m2[k][arr[i+2]]++;
    }
    function normalize(obj) {
        const t = sum(Object.values(obj));
        if (!t) return {B:0.46,P:0.44,T:0.10};
        return {B:obj.B/t, P:obj.P/t, T:obj.T/t};
    }
    const last1 = arr[arr.length-1];
    const last2 = arr.slice(-2).join('');
    const v1 = normalize(m1[last1]||{B:1,P:1,T:0});
    const v2 = m2[last2] ? normalize(m2[last2]) : v1;

    const w2 = arr.length > 40 ? 0.65 : 0.35;
    const vote = {
        B: v1.B*(1-w2) + v2.B*w2,
        P: v1.P*(1-w2) + v2.P*w2,
        T: v1.T*(1-w2) + v2.T*w2,
    };
    const s = vote.B+vote.P+vote.T;
    return { vote: {B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight: 2.2 };
}

// M06: ORDER-3 MARKOV
function m06_markov3(arr) {
    if (arr.length < 10) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0 };
    const m3 = {};
    for (let i = 0; i < arr.length - 3; i++) {
        const k = arr[i]+arr[i+1]+arr[i+2];
        if (!m3[k]) m3[k] = {B:0,P:0,T:0};
        m3[k][arr[i+3]]++;
    }
    const last3 = arr.slice(-3).join('');
    const trans = m3[last3];
    if (!trans) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0.3 };
    const t = sum(Object.values(trans));
    if (!t) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0.3 };
    const vote = {B:trans.B/t, P:trans.P/t, T:trans.T/t};
    const confidence = clamp(t / 5, 0.2, 1.0);
    return { vote, weight: 2.0 * confidence };
}

// M07: EWM MOMENTUM
function m07_momentum(arr) {
    const vals = arr.map(c => c==='B'?1 : c==='P'?-1 : 0);
    let ewm = vals[0]||0;
    const alpha = 0.25;
    for (let i = 1; i < vals.length; i++) ewm = alpha*vals[i] + (1-alpha)*ewm;

    let vote = {B:0.46, P:0.44, T:0.10};
    const str = clamp(Math.abs(ewm)*1.5, 0, 0.30);
    if (ewm > 0.12)       vote = {B:0.46+str, P:0.44-str, T:0.10};
    else if (ewm < -0.12) vote = {B:0.46-str, P:0.44+str, T:0.10};
    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:1.4, meta:{ewm} };
}

// M08: MULTI-WINDOW
function m08_windows(arr) {
    function wv(n) {
        const w = arr.slice(-n);
        const t = w.length||1;
        return {B:w.filter(c=>c==='B').length/t, P:w.filter(c=>c==='P').length/t, T:w.filter(c=>c==='T').length/t};
    }
    const w3=wv(3), w7=wv(7), w15=wv(15), w30=wv(30);
    const vote = {
        B: w3.B*0.40 + w7.B*0.30 + w15.B*0.20 + w30.B*0.10,
        P: w3.P*0.40 + w7.P*0.30 + w15.P*0.20 + w30.P*0.10,
        T: w3.T*0.40 + w7.T*0.30 + w15.T*0.20 + w30.T*0.10,
    };
    const s = vote.B+vote.P+vote.T||1;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:1.6 };
}

// M09: TIE CYCLE
function m09_tie(arr) {
    const tp = arr.reduce((a,c,i)=>{ if(c==='T') a.push(i); return a; },[]);
    const freq = (tp.length/arr.length)*100;
    let vote = {B:0.46, P:0.44, T:0.10};
    let tieW = 1.0;

    if (tp.length >= 3) {
        const gaps = [];
        for (let i=1; i<tp.length; i++) gaps.push(tp[i]-tp[i-1]);
        const avgGap = mean(gaps);
        const stdGap = Math.sqrt(mean(gaps.map(g=>(g-avgGap)**2)));
        const lastGap = arr.length-1-tp[tp.length-1];
        const gapScore = lastGap/avgGap;
        const stability = 1 - clamp(stdGap/avgGap, 0, 1);

        if (gapScore >= 0.8 && stability > 0.4 && freq > 6) {
            const tieBoost = clamp(gapScore * stability * 0.25, 0.05, 0.35);
            const tB = 0.10 + tieBoost;
            const rem = 1 - tB;
            vote = {B: rem*0.51, P: rem*0.49, T: tB};
            tieW = 1.5 + stability;
        } else if (freq > 12) {
            vote = {B:0.43, P:0.42, T:0.15};
        }

        const s = vote.B+vote.P+vote.T;
        return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:tieW,
            meta:{gapScore, stability, avgGap, freq} };
    }
    if (freq > 12) vote = {B:0.43, P:0.42, T:0.15};
    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:tieW, meta:{freq} };
}

// M10: MEAN REVERSION
function m10_meanRevert(arr) {
    const cnt = {B:0,P:0,T:0};
    for (const c of arr) if (cnt[c]!==undefined) cnt[c]++;
    const N = arr.length;
    const bPct = cnt.B/N*100, pPct = cnt.P/N*100;
    const bDev = bPct - 45.86, pDev = pPct - 44.62;

    let vote = {B:0.46, P:0.44, T:0.10};
    const maxDev = Math.max(Math.abs(bDev), Math.abs(pDev));
    const str = clamp(maxDev/25, 0, 0.28);

    if (bDev > 5)       vote = {B:0.46-str, P:0.44+str, T:0.10};
    else if (pDev > 5)  vote = {B:0.46+str, P:0.44-str, T:0.10};

    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:1.3,
        meta:{bDev:Math.round(bDev*10)/10, pDev:Math.round(pDev*10)/10} };
}

// M11: REGIME CLASSIFIER
function m11_regime(arr) {
    const r20 = arr.slice(-20);
    let sw = 0;
    for (let i=1; i<r20.length; i++) {
        if (r20[i]!==r20[i-1] && r20[i]!=='T' && r20[i-1]!=='T') sw++;
    }
    const swRate = sw/(r20.length-1||1);
    const lastNT = [...arr].reverse().find(c=>c!=='T')||'B';
    const regime = swRate>0.62?'CHOP' : swRate<0.33?'STREAK' : 'MIXED';
    const str = clamp(Math.abs(swRate-0.5)*1.8, 0, 0.30);

    let vote = {B:0.46, P:0.44, T:0.10};
    if (regime==='CHOP') {
        if (lastNT==='B') vote = {B:0.46-str, P:0.44+str, T:0.10};
        else              vote = {B:0.46+str, P:0.44-str, T:0.10};
    } else if (regime==='STREAK') {
        if (lastNT==='B') vote = {B:0.46+str, P:0.44-str, T:0.10};
        else              vote = {B:0.46-str, P:0.44+str, T:0.10};
    }
    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:1.7,
        meta:{regime, swRate:Math.round(swRate*100)} };
}

// M12: AUTOCORRELATION
function m12_acf(arr) {
    const vals = arr.map(c=>c==='B'?1:c==='P'?-1:0);
    const mu = mean(vals);
    const dv = vals.map(v=>v-mu);
    const den = sum(dv.map(d=>d*d))||1;
    const acf1 = sum(dv.slice(0,-1).map((d,i)=>d*dv[i+1]))/den;
    const acf2 = dv.length>2 ? sum(dv.slice(0,-2).map((d,i)=>d*dv[i+2]))/den : 0;
    const acfBlend = acf1*0.7 + acf2*0.3;

    const lastNT = [...arr].reverse().find(c=>c!=='T')||'B';
    const str = clamp(Math.abs(acfBlend)*1.5, 0, 0.28);

    let vote = {B:0.46, P:0.44, T:0.10};
    if (acfBlend > 0.08) {
        if (lastNT==='B') vote = {B:0.46+str, P:0.44-str, T:0.10};
        else              vote = {B:0.46-str, P:0.44+str, T:0.10};
    } else if (acfBlend < -0.08) {
        if (lastNT==='B') vote = {B:0.46-str, P:0.44+str, T:0.10};
        else              vote = {B:0.46+str, P:0.44-str, T:0.10};
    }
    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:1.3,
        meta:{acf1:Math.round(acf1*100)/100, acf2:Math.round(acf2*100)/100} };
}

// M13: HOT/COLD
function m13_hotcold(arr) {
    if (arr.length < 15) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0.5 };
    const r15 = arr.slice(-15);
    const fullB = arr.filter(c=>c==='B').length/arr.length;
    const fullP = arr.filter(c=>c==='P').length/arr.length;
    const recB  = r15.filter(c=>c==='B').length/r15.length;
    const recP  = r15.filter(c=>c==='P').length/r15.length;
    const bHot  = recB - fullB;
    const pHot  = recP - fullP;
    const maxHot = Math.max(Math.abs(bHot), Math.abs(pHot));
    const str   = clamp(maxHot*2.5, 0, 0.28);

    let vote = {B:0.46, P:0.44, T:0.10};
    if (bHot > 0.10)      vote = {B:0.46-str, P:0.44+str, T:0.10};
    else if (pHot > 0.10) vote = {B:0.46+str, P:0.44-str, T:0.10};

    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s, P:vote.P/s, T:vote.T/s}, weight:1.2,
        meta:{bHot:Math.round(bHot*100), pHot:Math.round(pHot*100)} };
}

// M14: PATTERN COMPLETION
function m14_patComp(arr) {
    if (arr.length < 14) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0 };
    const searchIn = arr.slice(0,-6);
    const recent = arr.slice(-6);
    let best = { match:false, predicted:null, conf:0, samples:0 };

    for (let plen = 5; plen >= 3; plen--) {
        const partial = recent.slice(0, plen).join('');
        const haystack = searchIn.join('');
        const votes = {B:0,P:0,T:0};
        let idx = 0;
        while (true) {
            const found = haystack.indexOf(partial, idx);
            if (found === -1) break;
            const nextIdx = found + plen;
            if (nextIdx < searchIn.length) {
                const next = searchIn[nextIdx];
                if (votes[next] !== undefined) votes[next]++;
            }
            idx = found + 1;
        }
        const total = votes.B + votes.P + votes.T;
        if (total >= 3) {
            best = {
                match: true,
                predicted: Object.entries(votes).sort((a,b)=>b[1]-a[1])[0][0],
                conf: clamp(Math.max(votes.B,votes.P,votes.T)/total, 0.3, 0.85),
                samples: total,
                vote: {B:votes.B/total, P:votes.P/total, T:votes.T/total}
            };
            break;
        }
    }

    if (!best.match) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0.3 };
    const w = clamp(best.samples/10 * best.conf * 2.5, 0.5, 2.5);
    return { vote: best.vote, weight: w, meta:{ conf:Math.round(best.conf*100), samples:best.samples } };
}

// M15: VOLATILITY ADAPTIVE
function m15_volatility(arr) {
    const w = arr.slice(-20);
    let ch = 0;
    for (let i=1; i<w.length; i++) if(w[i]!==w[i-1]) ch++;
    const vol = ch/(w.length-1||1);

    const freq = m01_bayesFreq(arr);
    const volFactor = clamp(vol, 0, 1);

    if (vol > 0.65) return { vote: freq.vote, weight: 1.5 * volFactor };
    return { vote:{B:0.46,P:0.44,T:0.10}, weight:0.3, meta:{vol:Math.round(vol*100)} };
}

// M16: ENTROPY
function m16_entropy(arr) {
    const cnt = {B:0,P:0,T:0};
    for (const c of arr) if(cnt[c]!==undefined) cnt[c]++;
    const N = arr.length;
    let H = 0;
    for (const k of ['B','P','T']) {
        const p = cnt[k]/N;
        if (p>0) H -= p*Math.log2(p);
    }
    const pred = 1 - H/Math.log2(3);
    const dom = cnt.B > cnt.P ? 'B' : 'P';
    const str = clamp(pred*0.25, 0, 0.20);
    let vote = {B:0.46,P:0.44,T:0.10};
    if (pred > 0.4) {
        if (dom==='B') vote={B:0.46+str,P:0.44-str,T:0.10};
        else           vote={B:0.46-str,P:0.44+str,T:0.10};
    }
    const s = vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s,P:vote.P/s,T:vote.T/s}, weight:0.9,
        meta:{entropy:Math.round(H*10)/10, predictability:Math.round(pred*100)} };
}

// M17: RECENCY DECAY
function m17_recencyDecay(arr) {
    const decay = 0.88;
    let wB=0, wP=0, wT=0, totalW=0;
    for (let i=0; i<arr.length; i++) {
        const w = Math.pow(decay, arr.length-1-i);
        if (arr[i]==='B') wB+=w;
        else if (arr[i]==='P') wP+=w;
        else wT+=w;
        totalW+=w;
    }
    const vote = {B:wB/totalW, P:wP/totalW, T:wT/totalW};
    return { vote, weight:1.4 };
}

// M18: HOUSE EDGE BASELINE
function m18_houseEdge(arr) {
    return { vote:{B:0.4586,P:0.4462,T:0.0952}, weight:0.8 };
}

// M19: SESSION FATIGUE
function m19_fatigue(tableId) {
    const hist = predHistory[tableId]||[];
    if (hist.length < 6) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0.3 };
    const last6 = hist.slice(-6);
    const bRun = last6.filter(p=>p==='B').length;
    const pRun = last6.filter(p=>p==='P').length;
    let vote = {B:0.46,P:0.44,T:0.10};
    if (bRun>=5) vote={B:0.36,P:0.54,T:0.10};
    else if (bRun>=4) vote={B:0.40,P:0.50,T:0.10};
    else if (pRun>=5) vote={B:0.54,P:0.36,T:0.10};
    else if (pRun>=4) vote={B:0.50,P:0.40,T:0.10};
    const s=vote.B+vote.P+vote.T;
    return { vote:{B:vote.B/s,P:vote.P/s,T:vote.T/s}, weight:0.9 };
}

// M20: CLUSTER ANALYSIS
function m20_cluster(arr) {
    if (arr.length < 20) return { vote:{B:0.46,P:0.44,T:0.10}, weight:0 };
    const tail = arr.slice(-5).join('');
    const windows = [];
    for (let i=0; i<=arr.length-6; i++) {
        const w = arr.slice(i,i+5).join('');
        let dist = 0;
        for (let j=0; j<5; j++) if(tail[j]!==w[j]) dist++;
        windows.push({ dist, next: arr[i+5] });
    }
    windows.sort((a,b)=>a.dist-b.dist);
    const top = windows.slice(0,8);
    const votes={B:0,P:0,T:0};
    for (const t of top) {
        const w = 1/(t.dist+1);
        if(votes[t.next]!==undefined) votes[t.next]+=w;
    }
    const s=votes.B+votes.P+votes.T||1;
    return { vote:{B:votes.B/s,P:votes.P/s,T:votes.T/s}, weight:1.8 };
}

// ============================================================
// MASTER PREDICTOR
// ============================================================
function predictVIP(history, tableId = 'UNKNOWN') {
    const DEFAULT = {
        banker: { prediction: 'Banker', rate: 46, confidence: 50, signal: 'NEUTRAL' },
        player: { prediction: 'Player', rate: 44, confidence: 50, signal: 'NEUTRAL' },
        tie: { prediction: 'Tie', rate: 10, confidence: 50, signal: 'NEUTRAL' },
        recommend: 'Player',
        recommendRate: 44,
        recommendConf: 50,
        pattern: 'Chưa đủ dữ liệu',
        cau_goc: history || '',
        stats: {}
    };

    if (!history || history.length < 5) return DEFAULT;
    const arr = toArr(history);
    if (arr.length < 5) return DEFAULT;

    // Run all 20 modules
    const modules = [
        m01_bayesFreq(arr), m02_streak(arr), m03_zigzag(arr), m04_patterns(arr),
        m05_markov(arr), m06_markov3(arr), m07_momentum(arr), m08_windows(arr),
        m09_tie(arr), m10_meanRevert(arr), m11_regime(arr), m12_acf(arr),
        m13_hotcold(arr), m14_patComp(arr), m15_volatility(arr), m16_entropy(arr),
        m17_recencyDecay(arr), m18_houseEdge(arr), m19_fatigue(tableId), m20_cluster(arr)
    ];

    // Weighted ensemble
    let totalW = 0, sumB = 0, sumP = 0, sumT = 0;
    for (const m of modules) {
        if (!m || m.weight <= 0) continue;
        sumB += m.vote.B * m.weight;
        sumP += m.vote.P * m.weight;
        sumT += m.vote.T * m.weight;
        totalW += m.weight;
    }
    let rB = (sumB / totalW) * 100;
    let rP = (sumP / totalW) * 100;
    let rT = (sumT / totalW) * 100;

    // Soft floor & normalize
    rB = Math.max(rB, 8);
    rP = Math.max(rP, 8);
    rT = Math.max(rT, 3);
    const rawSum = rB + rP + rT;
    rB = (rB / rawSum) * 100;
    rP = (rP / rawSum) * 100;
    rT = (rT / rawSum) * 100;

    // Confidence per side
    const avgOthersB = (rP + rT) / 2;
    const avgOthersP = (rB + rT) / 2;
    const avgOthersT = (rB + rP) / 2;
    const confB = clamp(50 + (rB - avgOthersB) * 1.8, 48, 92);
    const confP = clamp(50 + (rP - avgOthersP) * 1.8, 48, 92);
    const confT = clamp(50 + (rT - avgOthersT) * 1.8, 40, 85);

    function signal(rate, conf) {
        if (conf >= 78) return 'STRONG';
        if (conf >= 65) return 'MEDIUM';
        return 'WEAK';
    }

    // Pattern detection
    const reg = m11_regime(arr);
    const stk = m02_streak(arr);
    const ptt = m04_patterns(arr);
    const tieM = m09_tie(arr);
    const zzM = m03_zigzag(arr);
    const pcM = m14_patComp(arr);

    let pattern = 'Cầu đan xen';
    if (tieM.meta?.gapScore >= 0.85) {
        pattern = `🔮 TIE SIGNAL — Gap=${Math.round(tieM.meta?.avgGap||0)}, Freq=${Math.round(tieM.meta?.freq||0)}%, Score=${Math.round((tieM.meta?.gapScore||0)*100)}%`;
    } else if (reg.meta?.regime === 'CHOP') {
        pattern = `⚡ Chop Regime (${reg.meta?.swRate}% switches)`;
    } else if (reg.meta?.regime === 'STREAK') {
        pattern = `🔥 Streak Regime — ${stk.meta?.streak} (cont=${Math.round((stk.meta?.contP||0)*100)}%)`;
    } else if (ptt.meta?.pattern !== 'NONE') {
        pattern = `📐 Pattern ${ptt.meta?.pattern}`;
    } else if (zzM.meta?.zzScore > 0.55) {
        pattern = `↔️ Zigzag Score=${Math.round((zzM.meta?.zzScore||0)*100)}%`;
    } else if (pcM.meta?.conf > 0) {
        pattern = `🔍 Sequence Match (conf=${pcM.meta?.conf}%, n=${pcM.meta?.samples})`;
    }

    // Recommend
    const sides = [
        { name: 'Banker', rate: Math.round(rB), conf: Math.round(confB) },
        { name: 'Player', rate: Math.round(rP), conf: Math.round(confP) },
        { name: 'Tie', rate: Math.round(rT), conf: Math.round(confT) }
    ];
    const best = sides.reduce((a, b) => a.conf > b.conf ? a : b);

    // Round & sum=100
    let b = Math.round(rB), p = Math.round(rP), t = Math.round(rT);
    const rs = b + p + t;
    if (rs !== 100) {
        const diff = 100 - rs;
        if (b >= p && b >= t) b += diff;
        else if (p >= b && p >= t) p += diff;
        else t += diff;
    }

    // Store for fatigue
    if (!predHistory[tableId]) predHistory[tableId] = [];
    predHistory[tableId].push(best.name[0]);
    if (predHistory[tableId].length > 25) predHistory[tableId].shift();

    return {
        banker: {
            prediction: 'Banker',
            rate: b,
            confidence: Math.round(confB),
            signal: signal(b, confB),
            label: `${b}% | Conf: ${Math.round(confB)}% | ${signal(b, confB)}`
        },
        player: {
            prediction: 'Player',
            rate: p,
            confidence: Math.round(confP),
            signal: signal(p, confP),
            label: `${p}% | Conf: ${Math.round(confP)}% | ${signal(p, confP)}`
        },
        tie: {
            prediction: 'Tie',
            rate: t,
            confidence: Math.round(confT),
            signal: signal(t, confT),
            label: `${t}% | Conf: ${Math.round(confT)}% | ${signal(t, confT)}`
        },
        recommend: best.name,
        recommendRate: best.rate,
        recommendConf: best.conf,
        pattern,
        cau_goc: history,
        stats: {
            B: Math.round(rB),
            P: Math.round(rP),
            T: Math.round(rT),
            regime: reg.meta?.regime,
            streak: stk.meta?.streak,
            acf: m12_acf(arr).meta?.acf1,
            momentum: m07_momentum(arr).meta?.ewm,
            meanRevertB: m10_meanRevert(arr).meta?.bDev,
            meanRevertP: m10_meanRevert(arr).meta?.pDev,
            entropy: m16_entropy(arr).meta?.entropy,
            predictability: m16_entropy(arr).meta?.predictability,
            hotB: m13_hotcold(arr).meta?.bHot,
            hotP: m13_hotcold(arr).meta?.pHot,
            pattern: ptt.meta?.pattern,
            tieFreq: Math.round(tieM.meta?.freq || 0),
            modules: 20
        }
    };
}

// ============================================================
// API ROUTES
// ============================================================
async function fetchTableData(tableId) {
    try {
        const url = `${API_BASE}/api/baccarat/${tableId.toUpperCase()}`;
        console.log(`📡 ${url}`);
        const res = await axios.get(url, { timeout: 15000 });
        if (res.data?.success && res.data?.data) return res.data.data.result || '';
        return '';
    } catch (e) {
        console.error(`❌ ${tableId}:`, e.message);
        return '';
    }
}

// ── API: Dự đoán 1 bàn (JSON gọn) ──
app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ 
                success: false, 
                message: `Không tìm thấy bàn ${tableId}` 
            });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const r = predictVIP(cauGoc, tableId);

        // ── TRẢ VỀ JSON GỌN ──
        res.json({
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            Dự_đoán: r.recommend,
            Tỉ_lệ: `${r.recommendRate}%`,
            Dự_đoán_Tie: r.tie.prediction,
            Tỉ_lệ_tie: `${r.tie.rate}%`,
            Cầu: r.pattern
        });
    } catch (e) {
        res.status(500).json({ 
            success: false, 
            error: e.message 
        });
    }
});

// ── API: Dự đoán tất cả bàn (JSON gọn) ──
app.get('/api/predict/all', async (req, res) => {
    try {
        const tableIds = ['C01', 'C02', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10', 'C11', 'C15', 'C16', 'C17', 'C18', 'C19', 'C20'];
        const predictions = {};

        for (const id of tableIds) {
            const cauGoc = await fetchTableData(id);
            if (!cauGoc) continue;

            const old = lastData[id] || '';
            const isNew = cauGoc !== old && cauGoc.length > old.length;
            lastData[id] = cauGoc;
            if (!sessionData[id]) sessionData[id] = 0;
            if (isNew) sessionData[id]++;

            const r = predictVIP(cauGoc, id);
            
            predictions[id] = {
                cầu_gốc: cauGoc,
                B: `${r.banker.rate}%`,
                P: `${r.player.rate}%`,
                T: `${r.tie.rate}%`,
                khuyến_nghị: r.recommend,
                tin_cậy: `${r.recommendConf}%`,
                cầu: r.pattern
            };
        }

        res.json({
            success: true,
            engine: 'VIP-v16.0.0-20MODULE',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            predictions
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── API: Lấy dữ liệu bàn ──
app.get('/api/baccarat/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const result = await fetchTableData(tableId);
        if (result) {
            res.json({ success: true, data: { table: tableId, result, shoeId: '', round: '' } });
        } else {
            res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// ── Root ──
app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP ULTRA — FULL B/P/T',
        version: '16.0.0',
        author: '@tranhoang2286',
        modules: [
            'M01 Bayesian Frequency', 'M02 Streak Dynamics',
            'M03 Zigzag Windowed', 'M04 Multi-Pattern (5 types)',
            'M05 Markov O1+O2', 'M06 Markov Order-3',
            'M07 EWM Momentum', 'M08 Multi-Window (4 windows)',
            'M09 Tie Cycle Detector', 'M10 Mean Reversion',
            'M11 Regime Classifier', 'M12 ACF Lag 1+2',
            'M13 Hot/Cold Cooldown', 'M14 Pattern Completion',
            'M15 Volatility Adaptive', 'M16 Entropy Signal',
            'M17 Recency Decay Vote', 'M18 House Edge Baseline',
            'M19 Session Fatigue', 'M20 Cluster Analysis'
        ],
        output: 'BANKER% + PLAYER% + TIE% — đều có confidence + signal riêng',
        endpoints: {
            'Dự đoán 1 bàn (JSON gọn)': '/api/predict/:tableId',
            'Dự đoán tất cả (JSON gọn)': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════════');
    console.log('🃏 BACCARAT VIP ULTRA — v16.0.0 FULL B/P/T');
    console.log('══════════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('📌 20 MODULES — ZERO RANDOM — FULL SEPARATE');
    console.log('   B có tỉ lệ riêng + conf riêng + signal riêng');
    console.log('   P có tỉ lệ riêng + conf riêng + signal riêng');
    console.log('   T có tỉ lệ riêng + conf riêng + signal riêng');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════════');
});
