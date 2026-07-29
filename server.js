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
const predictionHistory = {}; // NEW: track prediction accuracy per table

// ============================================================
// HELPERS
// ============================================================
function toArray(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}

function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}

// ============================================================
// METHOD 1: FREQUENCY (BAYESIAN-ADJUSTED)
// ============================================================
function analyzeFrequency(arr) {
    const prior = { B: 45.86, P: 44.62, T: 9.52 };
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) counts[c]++;
    const total = arr.length;
    const alpha = 20; // prior strength

    const post = {};
    for (const k of ['B','P','T']) {
        post[k] = (counts[k] + (prior[k] / 100) * alpha) / (total + alpha) * 100;
    }
    return { post, counts, pct: { B: (counts.B/total)*100, P: (counts.P/total)*100, T: (counts.T/total)*100 } };
}

// ============================================================
// METHOD 2: STREAK ANALYSIS (ENHANCED)
// ============================================================
function analyzeStreak(arr) {
    let streaks = [];
    let cur = { char: arr[0], len: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.char) {
            cur.len++;
        } else {
            streaks.push({ ...cur });
            cur = { char: arr[i], len: 1 };
        }
    }
    streaks.push({ ...cur });

    const last = streaks[streaks.length - 1];
    const secondLast = streaks[streaks.length - 2] || null;

    // Average streak length per side
    const avgB = streaks.filter(s => s.char === 'B').reduce((a,s) => a + s.len, 0) /
                 (streaks.filter(s => s.char === 'B').length || 1);
    const avgP = streaks.filter(s => s.char === 'P').reduce((a,s) => a + s.len, 0) /
                 (streaks.filter(s => s.char === 'P').length || 1);

    return { last, secondLast, streaks, avgB, avgP };
}

// ============================================================
// METHOD 3: ZIGZAG DETECTION (WINDOWED)
// ============================================================
function analyzeZigzag(arr) {
    const window10 = arr.slice(-10);
    const windowFull = arr;
    
    function countZZ(a) {
        let zz = 0;
        for (let i = 1; i < a.length - 1; i++) {
            if (a[i] !== 'T' && a[i-1] !== 'T' && a[i+1] !== 'T') {
                if (a[i] !== a[i-1] && a[i] !== a[i+1]) zz++;
            }
        }
        return zz;
    }

    return {
        zz10: countZZ(window10),
        zzFull: countZZ(windowFull),
        isZZ: countZZ(window10) >= 3
    };
}

// ============================================================
// METHOD 4: PATTERN RECOGNITION (2-2, 3-3, 1-2-1, 2-1-2)
// ============================================================
function analyzePatterns(arr) {
    // NEW: encode streaks into run-length
    const runs = [];
    let cur = { char: arr[0], len: 1 };
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.char) cur.len++;
        else { runs.push({ ...cur }); cur = { char: arr[i], len: 1 }; }
    }
    runs.push({ ...cur });

    const last4runs = runs.slice(-4).map(r => r.len);
    const last4chars = runs.slice(-4).map(r => r.char);

    // Pattern 2-2: BBPP or PPBB
    const is22 = last4runs.length >= 2 &&
                 last4runs[last4runs.length-1] === 2 &&
                 last4runs[last4runs.length-2] === 2 &&
                 last4chars[last4chars.length-1] !== last4chars[last4chars.length-2];

    // Pattern 3-3
    const is33 = last4runs.length >= 2 &&
                 last4runs[last4runs.length-1] === 3 &&
                 last4runs[last4runs.length-2] === 3;

    // Pattern 1-2-1
    const is121 = last4runs.length >= 3 &&
                  last4runs[last4runs.length-3] === 1 &&
                  last4runs[last4runs.length-2] === 2 &&
                  last4runs[last4runs.length-1] === 1;

    // Pattern 2-1-2
    const is212 = last4runs.length >= 3 &&
                  last4runs[last4runs.length-3] === 2 &&
                  last4runs[last4runs.length-2] === 1 &&
                  last4runs[last4runs.length-1] === 2;

    const lastRun = runs[runs.length - 1];
    const prevRun = runs[runs.length - 2] || null;

    return { is22, is33, is121, is212, runs, lastRun, prevRun };
}

// ============================================================
// METHOD 5: MARKOV CHAIN (ORDER 1 + ORDER 2)
// ============================================================
function analyzeMarkov(arr) {
    // Order-1
    const m1 = { B:{B:0,P:0,T:0}, P:{B:0,P:0,T:0}, T:{B:0,P:0,T:0} };
    for (let i = 0; i < arr.length - 1; i++) {
        if (m1[arr[i]]) m1[arr[i]][arr[i+1]]++;
    }

    // Order-2
    const m2 = {};
    for (let i = 0; i < arr.length - 2; i++) {
        const key = arr[i] + arr[i+1];
        if (!m2[key]) m2[key] = { B:0, P:0, T:0 };
        m2[key][arr[i+2]]++;
    }

    const last1 = arr[arr.length - 1];
    const last2 = arr.slice(-2).join('');

    function bestOf(trans) {
        const total = Object.values(trans).reduce((a,b) => a+b, 0);
        if (!total) return { pred: 'B', prob: 0 };
        let best = 'B', bestP = 0;
        for (const [k,v] of Object.entries(trans)) {
            if (v/total > bestP) { bestP = v/total; best = k; }
        }
        return { pred: best, prob: bestP };
    }

    const o1 = bestOf(m1[last1] || {B:1,P:1,T:0});
    const o2 = m2[last2] ? bestOf(m2[last2]) : { pred: 'B', prob: 0 };

    // Weighted: order2 more reliable when enough data
    const pred = (arr.length > 30 && o2.prob > 0.35) ? o2 : o1;
    return { o1, o2, pred };
}

// ============================================================
// METHOD 6: MOMENTUM (EWM - EXPONENTIAL WEIGHTED)
// ============================================================
function analyzeMomentum(arr) {
    const values = arr.map(c => c === 'B' ? 1 : c === 'P' ? -1 : 0);
    const alpha = 0.3;
    let ewm = values[0] || 0;
    for (let i = 1; i < values.length; i++) {
        ewm = alpha * values[i] + (1 - alpha) * ewm;
    }
    // ewm > 0 → Banker momentum, < 0 → Player momentum
    return { ewm, trend: ewm > 0.15 ? 'B' : ewm < -0.15 ? 'P' : 'NEUTRAL' };
}

// ============================================================
// METHOD 7: ENTROPY + PREDICTABILITY
// ============================================================
function analyzeEntropy(arr) {
    const counts = { B: 0, P: 0, T: 0 };
    for (const c of arr) counts[c]++;
    const total = arr.length;
    let entropy = 0;
    for (const c of ['B','P','T']) {
        const p = counts[c] / total;
        if (p > 0) entropy -= p * Math.log2(p);
    }
    const maxH = Math.log2(3);
    return { entropy, predictability: 1 - (entropy / maxH) };
}

// ============================================================
// METHOD 8: LAST N WINDOW BIAS
// ============================================================
function analyzeWindows(arr) {
    function countWindow(n) {
        const w = arr.slice(-n);
        return {
            B: w.filter(c => c==='B').length,
            P: w.filter(c => c==='P').length,
            T: w.filter(c => c==='T').length,
            len: w.length
        };
    }
    return { w5: countWindow(5), w10: countWindow(10), w20: countWindow(20) };
}

// ============================================================
// METHOD 9: TIE SIGNAL (ENHANCED CYCLE DETECTION)
// ============================================================
function analyzeTie(arr) {
    const tiePos = arr.reduce((acc, c, i) => { if (c==='T') acc.push(i); return acc; }, []);
    if (tiePos.length < 2) return { signal: false, freq: (tiePos.length/arr.length)*100, avgGap: Infinity, gapScore: 0 };

    const gaps = [];
    for (let i = 1; i < tiePos.length; i++) gaps.push(tiePos[i] - tiePos[i-1]);
    const avgGap = gaps.reduce((a,b)=>a+b,0) / gaps.length;
    const lastGap = arr.length - 1 - tiePos[tiePos.length-1];
    const freq = (tiePos.length / arr.length) * 100;

    // Gap score: how overdue is a tie?
    const gapScore = clamp(lastGap / avgGap, 0, 3);
    const signal = (gapScore >= 0.85 && freq > 7) || freq > 13;

    return { signal, freq, avgGap, lastGap, gapScore };
}

// ============================================================
// METHOD 10: MEAN REVERSION
// ============================================================
function analyzeMeanReversion(arr) {
    const freq = analyzeFrequency(arr);
    const pct = freq.pct;
    // If B% >> theoretical 45.86 → mean revert to P
    const bDeviation = pct.B - 45.86;
    const pDeviation = pct.P - 44.62;

    return {
        bDeviation,
        pDeviation,
        revertTo: bDeviation > 8 ? 'P' : pDeviation > 8 ? 'B' : 'NEUTRAL',
        strength: Math.max(Math.abs(bDeviation), Math.abs(pDeviation))
    };
}

// ============================================================
// METHOD 11: CHOP vs STREAK REGIME
// ============================================================
function analyzeRegime(arr) {
    const recent = arr.slice(-20);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    const switchRate = switches / (recent.length - 1);
    // > 0.6 → chop regime (zigzag dominant)
    // < 0.35 → streak regime
    return {
        switchRate,
        regime: switchRate > 0.6 ? 'CHOP' : switchRate < 0.35 ? 'STREAK' : 'MIXED'
    };
}

// ============================================================
// METHOD 12: AUTOCORRELATION LAG-1
// ============================================================
function analyzeAutoCorr(arr) {
    const vals = arr.map(c => c==='B' ? 1 : c==='P' ? -1 : 0);
    const mean = vals.reduce((a,b)=>a+b,0) / vals.length;
    let num = 0, den = 0;
    for (let i = 0; i < vals.length - 1; i++) {
        num += (vals[i] - mean) * (vals[i+1] - mean);
    }
    for (let i = 0; i < vals.length; i++) {
        den += (vals[i] - mean) ** 2;
    }
    const acf = den === 0 ? 0 : num / den;
    // acf > 0 → trending, acf < 0 → reverting
    return { acf, type: acf > 0.1 ? 'TREND' : acf < -0.1 ? 'REVERT' : 'RANDOM' };
}

// ============================================================
// METHOD 13: SESSION FATIGUE (SCORE DRIFT CORRECTION)
// ============================================================
function analyzeSessionFatigue(tableId, currentPred) {
    if (!predictionHistory[tableId]) predictionHistory[tableId] = [];
    const hist = predictionHistory[tableId];
    if (hist.length < 5) return { fatigueBoost: { B: 0, P: 0, T: 0 } };

    const recent5 = hist.slice(-5);
    const bCount = recent5.filter(p => p === 'B').length;
    const pCount = recent5.filter(p => p === 'P').length;

    // If we've been calling B 4+ times in a row, add slight P boost
    const boost = { B: 0, P: 0, T: 0 };
    if (bCount >= 4) boost.P += 8;
    else if (pCount >= 4) boost.B += 8;

    return { fatigueBoost: boost };
}

// ============================================================
// METHOD 14: HOT/COLD ANALYSIS
// ============================================================
function analyzeHotCold(arr) {
    const recent = arr.slice(-15);
    const full = arr;
    const rcB = recent.filter(c=>c==='B').length / recent.length;
    const fullB = full.filter(c=>c==='B').length / full.length;
    const rcP = recent.filter(c=>c==='P').length / recent.length;
    const fullP = full.filter(c=>c==='P').length / full.length;

    // Hot: recent rate significantly above historical
    const bHot = rcB - fullB;
    const pHot = rcP - fullP;

    return {
        bHot, pHot,
        hotSide: bHot > 0.12 ? 'B' : pHot > 0.12 ? 'P' : 'NEUTRAL',
        // Hot side often cools → predict opposite
        coolDown: bHot > 0.15 ? 'P' : pHot > 0.15 ? 'B' : 'NEUTRAL'
    };
}

// ============================================================
// METHOD 15: PATTERN COMPLETION
// ============================================================
function analyzePatternCompletion(arr) {
    // Look for partial repeat of recent 6-card sequence
    if (arr.length < 12) return { match: false, predicted: null };
    
    const recent6 = arr.slice(-6).join('');
    const searchIn = arr.slice(0, -6).join('');
    
    for (let partial = 5; partial >= 3; partial--) {
        const partialSeq = recent6.substring(0, partial);
        const idx = searchIn.lastIndexOf(partialSeq);
        if (idx !== -1 && idx + partial < arr.length - 6) {
            const nextChar = arr[idx + partial];
            return { match: true, predicted: nextChar, confidence: partial / 6 };
        }
    }
    return { match: false, predicted: null, confidence: 0 };
}

// ============================================================
// METHOD 16: VOLATILITY INDEX
// ============================================================
function analyzeVolatility(arr) {
    const window = arr.slice(-20);
    let changes = 0;
    for (let i = 1; i < window.length; i++) {
        if (window[i] !== window[i-1]) changes++;
    }
    const vol = changes / (window.length - 1);
    // High volatility → patterns less reliable → fall back to frequency
    return { vol, isHigh: vol > 0.65, isLow: vol < 0.35 };
}

// ============================================================
// MASTER ENSEMBLE PREDICTOR
// ============================================================
function predictBCR(history, tableId = 'UNKNOWN') {
    if (!history || history.length < 3) {
        return {
            prediction: 'Player', bankerRate: 46, playerRate: 46, tieRate: 8,
            pattern: 'Chưa đủ dữ liệu', cau_goc: history || '',
            confidence: 50, stats: { B: 0, P: 0, T: 0 }
        };
    }

    const arr = toArray(history);
    if (arr.length < 3) {
        return {
            prediction: 'Player', bankerRate: 46, playerRate: 46, tieRate: 8,
            pattern: 'Chưa đủ dữ liệu', cau_goc: history || '',
            confidence: 50, stats: { B: 0, P: 0, T: 0 }
        };
    }

    // ── Run all methods ──
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
    const fatigue = analyzeSessionFatigue(tableId, null);
    const hotcold = analyzeHotCold(arr);
    const patcomp = analyzePatternCompletion(arr);
    const vol     = analyzeVolatility(arr);

    // ── Score accumulator ──
    let bScore = 0, pScore = 0, tScore = 0;

    // Weight map (total should sum roughly to 1600 baseline)
    // Each method contributes to a 0–100 mini-score weighted by importance

    // 1. FREQUENCY (Bayesian) — weight 80
    const fW = 80;
    bScore += (freq.post.B / 100) * fW;
    pScore += (freq.post.P / 100) * fW;
    tScore += (freq.post.T / 100) * fW;

    // 2. STREAK — weight 160
    const sW = 160;
    const sLast = streak.last;
    if (sLast.char !== 'T') {
        // Breakeven at streak len 3: below → continue, above → reverse
        const continueProbability = Math.max(0, 1 - (sLast.len - 1) * 0.25);
        const reverseProbability  = 1 - continueProbability;
        const cont = sLast.char;
        const rev  = cont === 'B' ? 'P' : 'B';
        if (cont === 'B') { bScore += continueProbability * sW; pScore += reverseProbability * sW; }
        else               { pScore += continueProbability * sW; bScore += reverseProbability * sW; }
    } else {
        bScore += 0.46 * sW; pScore += 0.44 * sW; tScore += 0.10 * sW;
    }

    // 3. ZIGZAG — weight 120
    const zzW = 120;
    if (zigzag.isZZ) {
        const lastNonT = [...arr].reverse().find(c => c !== 'T');
        if (lastNonT === 'B') { pScore += 0.75 * zzW; bScore += 0.25 * zzW; }
        else if (lastNonT === 'P') { bScore += 0.75 * zzW; pScore += 0.25 * zzW; }
        else { bScore += 0.5 * zzW; pScore += 0.5 * zzW; }
    } else {
        bScore += 0.5 * zzW; pScore += 0.5 * zzW;
    }

    // 4. PATTERNS — weight 140
    const ptW = 140;
    const pLastChar = patt.lastRun?.char;
    const pPrevChar = patt.prevRun?.char;
    if (patt.is22) {
        // 2-2 pattern → continue current in 2-2 cadence: next is a pair of the previous
        const nextIn22 = pPrevChar === 'B' ? 'B' : 'P';
        if (nextIn22 === 'B') { bScore += 0.78 * ptW; pScore += 0.22 * ptW; }
        else { pScore += 0.78 * ptW; bScore += 0.22 * ptW; }
    } else if (patt.is33) {
        const nextIn33 = pLastChar === 'B' ? 'P' : 'B';
        if (nextIn33 === 'B') { bScore += 0.78 * ptW; pScore += 0.22 * ptW; }
        else { pScore += 0.78 * ptW; bScore += 0.22 * ptW; }
    } else if (patt.is121) {
        // 1-2-1 → next is likely a pair
        if (pLastChar === 'B') { bScore += 0.65 * ptW; pScore += 0.35 * ptW; }
        else { pScore += 0.65 * ptW; bScore += 0.35 * ptW; }
    } else if (patt.is212) {
        if (pLastChar === 'B') { bScore += 0.62 * ptW; pScore += 0.38 * ptW; }
        else { pScore += 0.62 * ptW; bScore += 0.38 * ptW; }
    } else {
        bScore += 0.5 * ptW; pScore += 0.5 * ptW;
    }

    // 5. MARKOV — weight 150
    const mkW = 150;
    const mkP = markov.pred;
    if (mkP.pred === 'B') { bScore += mkP.prob * mkW; pScore += (1 - mkP.prob) * 0.9 * mkW; tScore += 0.02 * mkW; }
    else if (mkP.pred === 'P') { pScore += mkP.prob * mkW; bScore += (1 - mkP.prob) * 0.9 * mkW; tScore += 0.02 * mkW; }
    else { tScore += mkP.prob * mkW; bScore += 0.46 * (1 - mkP.prob) * mkW; pScore += 0.44 * (1 - mkP.prob) * mkW; }

    // 6. MOMENTUM (EWM) — weight 100
    const moW = 100;
    if (mom.trend === 'B') { bScore += 0.70 * moW; pScore += 0.30 * moW; }
    else if (mom.trend === 'P') { pScore += 0.70 * moW; bScore += 0.30 * moW; }
    else { bScore += 0.5 * moW; pScore += 0.5 * moW; }

    // 7. ENTROPY — weight 80
    const enW = 80;
    if (ent.predictability > 0.55) {
        const freqPred = freq.pct.B > freq.pct.P ? 'B' : 'P';
        if (freqPred === 'B') { bScore += 0.70 * enW; pScore += 0.30 * enW; }
        else { pScore += 0.70 * enW; bScore += 0.30 * enW; }
    } else if (ent.predictability < 0.25) {
        tScore += 0.4 * enW; bScore += 0.32 * enW; pScore += 0.28 * enW;
    } else {
        bScore += 0.5 * enW; pScore += 0.5 * enW;
    }

    // 8. WINDOWS — weight 130
    const wiW = 130;
    // Weighted avg of w5, w10, w20
    const wB = (wins.w5.B/wins.w5.len)*0.5 + (wins.w10.B/wins.w10.len)*0.3 + (wins.w20.B/wins.w20.len)*0.2;
    const wP = (wins.w5.P/wins.w5.len)*0.5 + (wins.w10.P/wins.w10.len)*0.3 + (wins.w20.P/wins.w20.len)*0.2;
    const wT = (wins.w5.T/wins.w5.len)*0.5 + (wins.w10.T/wins.w10.len)*0.3 + (wins.w20.T/wins.w20.len)*0.2;
    const wSum = wB + wP + wT || 1;
    bScore += (wB/wSum) * wiW;
    pScore += (wP/wSum) * wiW;
    tScore += (wT/wSum) * wiW;

    // 9. TIE SIGNAL — weight 100
    const tiW = 100;
    if (tie.signal) {
        const tieWeight = clamp(tie.gapScore * 0.35, 0.15, 0.50);
        tScore += tieWeight * tiW;
        bScore += (1 - tieWeight) * 0.46 * tiW;
        pScore += (1 - tieWeight) * 0.44 * tiW;
    } else {
        bScore += 0.46 * tiW; pScore += 0.44 * tiW; tScore += 0.10 * tiW;
    }

    // 10. MEAN REVERSION — weight 110
    const mrW = 110;
    if (mrev.revertTo === 'B') { bScore += 0.72 * mrW; pScore += 0.28 * mrW; }
    else if (mrev.revertTo === 'P') { pScore += 0.72 * mrW; bScore += 0.28 * mrW; }
    else { bScore += 0.5 * mrW; pScore += 0.5 * mrW; }

    // 11. REGIME — weight 100
    const rgW = 100;
    const lastNT = [...arr].reverse().find(c => c !== 'T');
    if (regime.regime === 'CHOP') {
        // Chop → flip from last
        if (lastNT === 'B') { pScore += 0.72 * rgW; bScore += 0.28 * rgW; }
        else { bScore += 0.72 * rgW; pScore += 0.28 * rgW; }
    } else if (regime.regime === 'STREAK') {
        // Streak → continue
        if (lastNT === 'B') { bScore += 0.68 * rgW; pScore += 0.32 * rgW; }
        else { pScore += 0.68 * rgW; bScore += 0.32 * rgW; }
    } else {
        bScore += 0.5 * rgW; pScore += 0.5 * rgW;
    }

    // 12. AUTOCORRELATION — weight 90
    const acW = 90;
    if (acf.type === 'TREND') {
        if (lastNT === 'B') { bScore += 0.68 * acW; pScore += 0.32 * acW; }
        else { pScore += 0.68 * acW; bScore += 0.32 * acW; }
    } else if (acf.type === 'REVERT') {
        if (lastNT === 'B') { pScore += 0.68 * acW; bScore += 0.32 * acW; }
        else { bScore += 0.68 * acW; pScore += 0.32 * acW; }
    } else {
        bScore += 0.5 * acW; pScore += 0.5 * acW;
    }

    // 13. SESSION FATIGUE — weight 60
    bScore += fatigue.fatigueBoost.B;
    pScore += fatigue.fatigueBoost.P;
    tScore += fatigue.fatigueBoost.T;

    // 14. HOT/COLD — weight 90
    const hcW = 90;
    if (hotcold.coolDown === 'B') { bScore += 0.68 * hcW; pScore += 0.32 * hcW; }
    else if (hotcold.coolDown === 'P') { pScore += 0.68 * hcW; bScore += 0.32 * hcW; }
    else { bScore += 0.5 * hcW; pScore += 0.5 * hcW; }

    // 15. PATTERN COMPLETION — weight 120
    const pcW = 120;
    if (patcomp.match && patcomp.predicted) {
        const pConf = patcomp.confidence;
        if (patcomp.predicted === 'B') { bScore += pConf * pcW; pScore += (1-pConf)*0.9 * pcW; }
        else if (patcomp.predicted === 'P') { pScore += pConf * pcW; bScore += (1-pConf)*0.9 * pcW; }
        else { tScore += pConf * pcW; bScore += (1-pConf)*0.46 * pcW; pScore += (1-pConf)*0.44 * pcW; }
    } else {
        bScore += 0.5 * pcW; pScore += 0.5 * pcW;
    }

    // 16. VOLATILITY CORRECTION — weight 80
    const vlW = 80;
    if (vol.isHigh) {
        // High vol → trust frequency over patterns → re-weight toward freq
        bScore += (freq.post.B/100) * vlW * 1.5;
        pScore += (freq.post.P/100) * vlW * 1.5;
        tScore += (freq.post.T/100) * vlW * 1.5;
    } else if (vol.isLow) {
        // Low vol → trust patterns more, already done above
        bScore += 0.5 * vlW; pScore += 0.5 * vlW;
    } else {
        bScore += 0.5 * vlW; pScore += 0.5 * vlW;
    }

    // ── NORMALIZE ──
    const total = bScore + pScore + tScore || 1;
    let bRate = (bScore / total) * 100;
    let pRate = (pScore / total) * 100;
    let tRate = (tScore / total) * 100;

    // Soft clamp — prevent extremes
    bRate = clamp(bRate, 30, 70);
    pRate = clamp(pRate, 30, 70);
    tRate = clamp(tRate, 4, 25);

    // Re-normalize after clamp
    const sum2 = bRate + pRate + tRate;
    bRate = (bRate / sum2) * 100;
    pRate = (pRate / sum2) * 100;
    tRate = (tRate / sum2) * 100;

    // ── PREDICTION ──
    let prediction;
    if (tie.signal && tRate > 18 && tRate > bRate * 0.75 && tRate > pRate * 0.75) {
        prediction = 'Tie';
    } else if (bRate > pRate) {
        prediction = 'Banker';
    } else {
        prediction = 'Player';
    }

    // ── ROUND ──
    let b = Math.round(bRate);
    let p = Math.round(pRate);
    let t = Math.round(tRate);
    const rSum = b + p + t;
    if (rSum !== 100) {
        const diff = 100 - rSum;
        if (b >= p && b >= t) b += diff;
        else if (p >= b && p >= t) p += diff;
        else t += diff;
    }

    // ── CONFIDENCE ──
    const raw = Math.max(b, p, t);
    let confidence = clamp(Math.round(raw * 0.9 + ent.predictability * 10), 50, 92);
    if (patcomp.match) confidence = clamp(confidence + 3, 50, 92);

    // ── PATTERN LABEL ──
    let pattern = 'Cầu đan xen';
    if (prediction === 'Tie' && tie.signal) {
        pattern = `🔮 TIE SIGNAL! Gap=${Math.round(tie.avgGap)}, Freq=${Math.round(tie.freq)}%, Overdue=${Math.round(tie.gapScore*100)}%`;
    } else if (regime.regime === 'CHOP') {
        pattern = `Chop Regime (Switch=${Math.round(regime.switchRate*100)}%) → Đảo chiều`;
    } else if (regime.regime === 'STREAK') {
        const ls = streak.last;
        pattern = `Streak Regime — Dây ${ls.char} x${ls.len} → Tiếp tục`;
    } else if (patt.is22) {
        pattern = `Cầu 2-2 Pattern đang hoạt động`;
    } else if (patt.is33) {
        pattern = `Cầu 3-3 Pattern`;
    } else if (patt.is121) {
        pattern = `Cầu 1-2-1 Pattern`;
    } else if (patt.is212) {
        pattern = `Cầu 2-1-2 Pattern`;
    } else if (zigzag.isZZ) {
        pattern = `Zigzag Mode (10 ván: ${zigzag.zz10} lần đổi)`;
    } else if (patcomp.match) {
        pattern = `Pattern Completion Match (conf=${Math.round(patcomp.confidence*100)}%)`;
    } else if (mrev.revertTo !== 'NEUTRAL') {
        pattern = `Mean Reversion → ${mrev.revertTo} (dev=${Math.round(mrev.strength)}%)`;
    } else {
        pattern = `ACF:${acf.type} | Mom:${mom.trend} | Vol:${Math.round(vol.vol*100)}%`;
    }

    // ── STORE PREDICTION FOR SESSION FATIGUE ──
    if (!predictionHistory[tableId]) predictionHistory[tableId] = [];
    predictionHistory[tableId].push(prediction[0]);
    if (predictionHistory[tableId].length > 20) predictionHistory[tableId].shift();

    return {
        prediction,
        bankerRate: Math.max(b, 5),
        playerRate: Math.max(p, 5),
        tieRate: Math.max(t, 3),
        pattern,
        cau_goc: history,
        confidence,
        tie_signal: tie.signal,
        tie_score: Math.round(tie.freq),
        stats: {
            B: Math.round(freq.pct.B),
            P: Math.round(freq.pct.P),
            T: Math.round(freq.pct.T),
            regime: regime.regime,
            acf: acf.type,
            momentum: mom.trend,
            streak: `${streak.last.char}x${streak.last.len}`,
            zigzag: zigzag.zz10,
            pattern22: patt.is22,
            pattern33: patt.is33,
            pattern121: patt.is121,
            patternCompletion: patcomp.match,
            hotSide: hotcold.hotSide,
            meanRevert: mrev.revertTo,
            volatility: Math.round(vol.vol * 100),
            entropy: Math.round(ent.entropy * 10) / 10,
            predictability: Math.round(ent.predictability * 100),
            tieGap: Math.round(tie.avgGap || 0),
            tieFrequency: Math.round(tie.freq),
            tieGapScore: Math.round((tie.gapScore || 0) * 100)
        }
    };
}

// ============================================================
// API ROUTES
// ============================================================
async function fetchTableData(tableId) {
    try {
        const normalizedId = tableId.toUpperCase();
        const url = `${API_BASE}/api/baccarat/${normalizedId}`;
        console.log(`📡 Gọi API: ${url}`);
        const response = await axios.get(url, { timeout: 15000 });
        if (response.data?.success && response.data?.data) {
            return response.data.data.result || '';
        }
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
        if (!cauGoc) return res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });

        const oldData = lastData[tableId] || '';
        const isNewData = cauGoc !== oldData && cauGoc.length > oldData.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNewData) sessionData[tableId]++;

        const result = predictBCR(cauGoc, tableId);

        res.json({
            success: true,
            bàn: `Bàn ${tableId}`,
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            dự_đoán: result.prediction,
            tỉ_lệ: `${Math.max(result.bankerRate, result.playerRate, result.tieRate)}%`,
            banker_rate: `${result.bankerRate}%`,
            player_rate: `${result.playerRate}%`,
            dự_đoán_tie: result.tie_signal ? 'CÓ' : 'KHÔNG',
            tỉ_lệ_tie: `${result.tieRate}%`,
            cầu: result.pattern,
            confidence: `${result.confidence}%`,
            stats: result.stats,
            engine: 'v15.0.0-ULTRA-16METHOD',
            id: '@tranhoang2286'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/predict/all', async (req, res) => {
    try {
        const tableIds = ['C01','C02','C04','C05','C06','C07','C08','C09','C10','C11','C15','C16','C17','C18','C19','C20'];
        const results = [];

        for (const id of tableIds) {
            const cauGoc = await fetchTableData(id);
            if (!cauGoc) continue;

            const oldData = lastData[id] || '';
            const isNewData = cauGoc !== oldData && cauGoc.length > oldData.length;
            lastData[id] = cauGoc;
            if (!sessionData[id]) sessionData[id] = 0;
            if (isNewData) sessionData[id]++;

            const result = predictBCR(cauGoc, id);
            results.push({
                bàn: `Bàn ${id}`,
                phiên: sessionData[id],
                cầu_gốc: cauGoc,
                dự_đoán: result.prediction,
                tỉ_lệ: `${Math.max(result.bankerRate, result.playerRate, result.tieRate)}%`,
                banker_rate: `${result.bankerRate}%`,
                player_rate: `${result.playerRate}%`,
                dự_đoán_tie: result.tie_signal ? 'CÓ' : 'KHÔNG',
                tỉ_lệ_tie: `${result.tieRate}%`,
                cầu: result.pattern,
                confidence: `${result.confidence}%`,
                regime: result.stats.regime
            });
        }

        res.json({ success: true, data: results, total: results.length, engine: 'v15.0.0-ULTRA', id: '@tranhoang2286' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/baccarat/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const result = await fetchTableData(tableId);
        if (result) {
            res.json({ success: true, data: { table: tableId, result, shoeId: '', round: '' } });
        } else {
            res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT PREDICTION ULTRA',
        version: '15.0.0',
        author: '@tranhoang2286',
        api_source: API_BASE,
        methods: [
            '1. Bayesian Frequency',     '2. Streak (Enhanced)',
            '3. Zigzag (Windowed)',       '4. Patterns (2-2/3-3/1-2-1/2-1-2)',
            '5. Markov (Order 1+2)',      '6. Momentum (EWM)',
            '7. Entropy',                 '8. Multi-Window Bias',
            '9. Tie Cycle Detection',     '10. Mean Reversion',
            '11. Regime (Chop/Streak)',   '12. Autocorrelation',
            '13. Session Fatigue',        '14. Hot/Cold Analysis',
            '15. Pattern Completion',     '16. Volatility Index'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════');
    console.log('🃏 BACCARAT PREDICTION ULTRA — v15.0.0');
    console.log('══════════════════════════════════════════');
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📡 API Source: ${API_BASE}`);
    console.log('📌 16 PHƯƠNG PHÁP PHÂN TÍCH:');
    console.log('   1. Bayesian Freq    2. Streak Enhanced');
    console.log('   3. Zigzag Window    4. Multi-Pattern');
    console.log('   5. Markov O1+O2     6. EWM Momentum');
    console.log('   7. Entropy          8. Multi-Window');
    console.log('   9. Tie Cycle       10. Mean Reversion');
    console.log('  11. Regime Detect   12. Autocorrelation');
    console.log('  13. Fatigue Corr    14. Hot/Cold');
    console.log('  15. Pat Completion  16. Volatility Idx');
    console.log('══════════════════════════════════════════');
    console.log(`👤 Author: @tranhoang2286`);
    console.log('══════════════════════════════════════════');
});
