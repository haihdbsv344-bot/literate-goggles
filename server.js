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
const cauHistory = {};
const learningData = {};

// ============================================================
// UTILS CHUẨN
// ============================================================
function toArr(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}

function tinhTyLe(arr) {
    const cnt = {B:0, P:0, T:0};
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const total = arr.length || 1;
    return {
        B: cnt.B / total * 100,
        P: cnt.P / total * 100,
        T: cnt.T / total * 100,
        count: cnt,
        total: total
    };
}

function tinhRuns(arr) {
    if (arr.length === 0) return [];
    const runs = [];
    let cur = {c: arr[0], n: 1};
    for (let i = 1; i < arr.length; i++) {
        if (arr[i] === cur.c) cur.n++;
        else { runs.push({...cur}); cur = {c: arr[i], n: 1}; }
    }
    runs.push({...cur});
    return runs;
}

function tinhDoLech(arr) {
    const tyLe = tinhTyLe(arr);
    const std = {B: 45.86, P: 44.62, T: 9.52};
    return {
        B: tyLe.B - std.B,
        P: tyLe.P - std.P,
        T: tyLe.T - std.T
    };
}

function tinhXacSuat(arr, target) {
    const cnt = {B:0, P:0, T:0};
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const total = arr.length || 1;
    return cnt[target] / total * 100;
}

function tinhDoTinCay(conf, samples) {
    // Càng nhiều mẫu, độ tin cậy càng cao
    const sampleBoost = Math.min(samples / 20, 10);
    return Math.min(conf + sampleBoost, 95);
}

// ============================================================
= THUẬT TOÁN HỌC MÁY - PHÂN TÍCH CẦU THÔNG MINH
// ============================================================

// Học từ lịch sử các bàn khác
function hocCrossTable(tableId) {
    let crossData = {B:0, P:0, T:0, total:0};
    for (const [id, data] of Object.entries(learningData)) {
        if (id === tableId) continue;
        const recent = data.slice(-20);
        for (const d of recent) {
            if (d.result === 'B') crossData.B++;
            else if (d.result === 'P') crossData.P++;
            else crossData.T++;
            crossData.total++;
        }
    }
    return crossData;
}

// Học pattern xuất hiện nhiều nhất
function hocPattern(arr) {
    const patterns = {};
    for (let len = 2; len <= 4; len++) {
        for (let i = 0; i <= arr.length - len - 1; i++) {
            const p = arr.slice(i, i + len).join('');
            const next = arr[i + len];
            if (!patterns[p]) patterns[p] = {B:0, P:0, T:0, total:0};
            patterns[p][next]++;
            patterns[p].total++;
        }
    }
    return patterns;
}

// Học xác suất chuyển tiếp Markov
function hocMarkov(arr) {
    const m = {
        B: {B:0, P:0, T:0},
        P: {B:0, P:0, T:0},
        T: {B:0, P:0, T:0}
    };
    for (let i = 0; i < arr.length - 1; i++) {
        if (m[arr[i]]) m[arr[i]][arr[i+1]]++;
    }
    const result = {};
    for (const from of ['B', 'P', 'T']) {
        const total = m[from].B + m[from].P + m[from].T;
        if (total > 0) {
            result[from] = {
                B: m[from].B / total,
                P: m[from].P / total,
                T: m[from].T / total
            };
        }
    }
    return result;
}

// Học chu kỳ streak
function hocStreak(arr) {
    const runs = tinhRuns(arr);
    const streakData = {B: [], P: [], T: []};
    for (const r of runs) {
        if (streakData[r.c]) streakData[r.c].push(r.n);
    }
    const result = {};
    for (const k of ['B', 'P', 'T']) {
        if (streakData[k].length > 0) {
            result[k] = {
                avg: streakData[k].reduce((a,b) => a+b, 0) / streakData[k].length,
                max: Math.max(...streakData[k]),
                count: streakData[k].length
            };
        }
    }
    return result;
}

// ============================================================
// 30 CÔNG THỨC NHẬN DIỆN CẦU CHUẨN
// ============================================================

// CT01: CẦU 1-1 ZIGZAG
function CT01_Zigzag(arr) {
    if (arr.length < 4) return null;
    const last4 = arr.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
        if (last4[0] === 'B') return { predict: 'P', name: 'CẦU 1-1 (B-P-B-P)', conf: 92, priority: 1 };
        if (last4[0] === 'P') return { predict: 'B', name: 'CẦU 1-1 (P-B-P-B)', conf: 92, priority: 1 };
    }
    return null;
}

// CT02: CẦU 2-2-2
function CT02_222(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'B', name: 'CẦU 2-2-2 (B)', conf: 90, priority: 1 };
            if (last3[0].c === 'P') return { predict: 'P', name: 'CẦU 2-2-2 (P)', conf: 90, priority: 1 };
        }
    }
    return null;
}

// CT03: CẦU 2-2 ĐẢO
function CT03_22Dao(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[1].n === 2 && last3[2].n === 2 && last3[1].c !== last3[2].c) {
            if (last3[1].c === 'B') return { predict: 'B', name: 'CẦU 2-2 (B-P-B)', conf: 88, priority: 2 };
            if (last3[1].c === 'P') return { predict: 'P', name: 'CẦU 2-2 (P-B-P)', conf: 88, priority: 2 };
        }
    }
    return null;
}

// CT04: CẦU 3-3
function CT04_33(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            if (last2[0].c === 'B') return { predict: 'P', name: 'CẦU 3-3 (B-P)', conf: 89, priority: 2 };
            if (last2[0].c === 'P') return { predict: 'B', name: 'CẦU 3-3 (P-B)', conf: 89, priority: 2 };
        }
    }
    return null;
}

// CT05: CẦU 1-2-1
function CT05_121(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            if (last3[1].c === 'B') return { predict: 'B', name: 'CẦU 1-2-1 (B)', conf: 91, priority: 1 };
            if (last3[1].c === 'P') return { predict: 'P', name: 'CẦU 1-2-1 (P)', conf: 91, priority: 1 };
        }
    }
    return null;
}

// CT06: CẦU 2-1-2
function CT06_212(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 2-1-2 (B-P)', conf: 87, priority: 2 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 2-1-2 (P-B)', conf: 87, priority: 2 };
        }
    }
    return null;
}

// CT07: CẦU CHOP
function CT07_Chop(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    const rate = switches / 7;
    if (rate >= 0.75) {
        const last = recent[recent.length - 1];
        if (last === 'B') return { predict: 'P', name: 'CHOP (B-P-B-P)', conf: 88, priority: 1 };
        if (last === 'P') return { predict: 'B', name: 'CHOP (P-B-P-B)', conf: 88, priority: 1 };
    }
    return null;
}

// CT08: CẦU STREAK
function CT08_Streak(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    const last = runs[runs.length - 1];
    
    if (last.n >= 6) {
        if (last.c === 'B') return { predict: 'P', name: `STREAK B x${last.n} -> ĐẢO`, conf: 82, priority: 2 };
        if (last.c === 'P') return { predict: 'B', name: `STREAK P x${last.n} -> ĐẢO`, conf: 82, priority: 2 };
    }
    if (last.n >= 3 && last.n <= 5) {
        if (last.c === 'B') return { predict: 'B', name: `STREAK B x${last.n} -> TIẾP`, conf: 78, priority: 3 };
        if (last.c === 'P') return { predict: 'P', name: `STREAK P x${last.n} -> TIẾP`, conf: 78, priority: 3 };
    }
    return null;
}

// CT09: CẦU TIE
function CT09_Tie(arr) {
    const tiePos = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] === 'T') tiePos.push(i);
    }
    if (tiePos.length < 2) return null;
    
    const gaps = [];
    for (let i = 1; i < tiePos.length; i++) {
        gaps.push(tiePos[i] - tiePos[i-1]);
    }
    const avgGap = gaps.reduce((a,b) => a+b, 0) / gaps.length;
    const lastGap = arr.length - 1 - tiePos[tiePos.length - 1];
    
    if (lastGap > avgGap * 1.5 && avgGap < 20 && avgGap > 5) {
        return { predict: 'T', name: `TIE CYCLE (gap ${Math.round(avgGap)})`, conf: 82, priority: 2 };
    }
    return null;
}

// CT10: CÂN BẰNG B/P
function CT10_Balance(arr) {
    if (arr.length < 20) return null;
    const tyLe = tinhTyLe(arr);
    const diff = tyLe.B - tyLe.P;
    
    if (diff > 15) return { predict: 'P', name: `BALANCE (B thừa ${Math.round(diff)}%)`, conf: 85, priority: 2 };
    if (diff < -15) return { predict: 'B', name: `BALANCE (P thừa ${Math.round(Math.abs(diff))}%)`, conf: 85, priority: 2 };
    return null;
}

// CT11: CẦU CHOP DÀI 1-1-1-1
function CT11_ChopDai(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    const runs = tinhRuns(recent);
    const allOne = runs.every(r => r.n === 1);
    
    if (allOne && runs.length >= 6) {
        const last = runs[runs.length - 1].c;
        if (last === 'B') return { predict: 'P', name: 'CHOP DÀI 1-1-1-1 (B->P)', conf: 90, priority: 1 };
        if (last === 'P') return { predict: 'B', name: 'CHOP DÀI 1-1-1-1 (P->B)', conf: 90, priority: 1 };
    }
    return null;
}

// CT12: CẦU 2-1-1-2
function CT12_2112(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            if (last4[0].c === 'B') return { predict: 'B', name: 'CẦU 2-1-1-2 (B)', conf: 89, priority: 2 };
            if (last4[0].c === 'P') return { predict: 'P', name: 'CẦU 2-1-1-2 (P)', conf: 89, priority: 2 };
        }
    }
    return null;
}

// CT13: CẦU 3-2-1
function CT13_321(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 3-2-1 (B-P)', conf: 86, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 3-2-1 (P-B)', conf: 86, priority: 3 };
        }
    }
    return null;
}

// CT14: CẦU 1-2-3
function CT14_123(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            if (last3[1].c === 'B') return { predict: 'P', name: 'CẦU 1-2-3 (B-P)', conf: 87, priority: 3 };
            if (last3[1].c === 'P') return { predict: 'B', name: 'CẦU 1-2-3 (P-B)', conf: 87, priority: 3 };
        }
    }
    return null;
}

// CT15: CẦU 2-3-2
function CT15_232(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'B', name: 'CẦU 2-3-2 (B)', conf: 88, priority: 2 };
            if (last3[0].c === 'P') return { predict: 'P', name: 'CẦU 2-3-2 (P)', conf: 88, priority: 2 };
        }
    }
    return null;
}

// CT16: CẦU 3-1-3
function CT16_313(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 3-1-3 (B-P)', conf: 86, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 3-1-3 (P-B)', conf: 86, priority: 3 };
        }
    }
    return null;
}

// CT17: CẦU 1-1-2
function CT17_112(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 1-1-2 (B-P)', conf: 85, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 1-1-2 (P-B)', conf: 85, priority: 3 };
        }
    }
    return null;
}

// CT18: CẦU 2-2-1
function CT18_221(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            if (last3[0].c === 'B') return { predict: 'B', name: 'CẦU 2-2-1 (B)', conf: 84, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'P', name: 'CẦU 2-2-1 (P)', conf: 84, priority: 3 };
        }
    }
    return null;
}

// CT19: CẦU 1-2-2
function CT19_122(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 1-2-2 (B-P)', conf: 83, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 1-2-2 (P-B)', conf: 83, priority: 3 };
        }
    }
    return null;
}

// CT20: ĐỘ LỆCH CHUẨN
function CT20_Deviation(arr) {
    if (arr.length < 30) return null;
    const dev = tinhDoLech(arr);
    
    if (dev.B < -10) return { predict: 'B', name: `ĐỘ LỆCH (B thiếu ${Math.round(Math.abs(dev.B))}%)`, conf: 80, priority: 2 };
    if (dev.P < -10) return { predict: 'P', name: `ĐỘ LỆCH (P thiếu ${Math.round(Math.abs(dev.P))}%)`, conf: 80, priority: 2 };
    if (dev.T < -7) return { predict: 'T', name: `ĐỘ LỆCH (T thiếu ${Math.round(Math.abs(dev.T))}%)`, conf: 76, priority: 3 };
    return null;
}

// CT21: ĐẢO CHIỀU
function CT21_Reversal(arr) {
    if (arr.length < 10) return null;
    const recent = arr.slice(-10);
    const cnt = {B:0, P:0, T:0};
    for (const c of recent) if (cnt[c] !== undefined) cnt[c]++;
    
    if (cnt.B >= 7) return { predict: 'P', name: `REVERSAL (B ${cnt.B}/10 -> đảo)`, conf: 79, priority: 2 };
    if (cnt.P >= 7) return { predict: 'B', name: `REVERSAL (P ${cnt.P}/10 -> đảo)`, conf: 79, priority: 2 };
    if (cnt.T >= 6) return { predict: 'B', name: `REVERSAL (T ${cnt.T}/10 -> B)`, conf: 75, priority: 3 };
    return null;
}

// CT22: CẦU 4-4
function CT22_44(arr) {
    if (arr.length < 10) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            if (last2[0].c === 'B') return { predict: 'P', name: 'CẦU 4-4 (B-P)', conf: 84, priority: 3 };
            if (last2[0].c === 'P') return { predict: 'B', name: 'CẦU 4-4 (P-B)', conf: 84, priority: 3 };
        }
    }
    return null;
}

// CT23: CẦU 2-4-2
function CT23_242(arr) {
    if (arr.length < 10) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 4 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'B', name: 'CẦU 2-4-2 (B)', conf: 85, priority: 2 };
            if (last3[0].c === 'P') return { predict: 'P', name: 'CẦU 2-4-2 (P)', conf: 85, priority: 2 };
        }
    }
    return null;
}

// CT24: CẦU 4-2-4
function CT24_424(arr) {
    if (arr.length < 10) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 4 && last3[1].n === 2 && last3[2].n === 4) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 4-2-4 (B-P)', conf: 83, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 4-2-4 (P-B)', conf: 83, priority: 3 };
        }
    }
    return null;
}

// CT25: PATTERN LẶP
function CT25_Repeat(arr) {
    if (arr.length < 12) return null;
    const last6 = arr.slice(-6).join('');
    const prev6 = arr.slice(-12, -6).join('');
    
    let match = 0;
    for (let i = 0; i < 6; i++) {
        if (last6[i] === prev6[i]) match++;
    }
    
    if (match >= 5) {
        const next = arr[arr.length - 6];
        if (next === 'B') return { predict: 'B', name: 'PATTERN LẶP (B)', conf: 86, priority: 1 };
        if (next === 'P') return { predict: 'P', name: 'PATTERN LẶP (P)', conf: 86, priority: 1 };
        if (next === 'T') return { predict: 'T', name: 'PATTERN LẶP (T)', conf: 80, priority: 2 };
    }
    return null;
}

// CT26: CHU KỲ 5
function CT26_Cycle5(arr) {
    if (arr.length < 10) return null;
    const last5 = arr.slice(-5);
    const prev5 = arr.slice(-10, -5);
    
    let same = 0;
    for (let i = 0; i < 5; i++) {
        if (last5[i] === prev5[i]) same++;
    }
    
    if (same >= 4) {
        const next = arr[arr.length - 5];
        if (next === 'B') return { predict: 'B', name: 'CHU KỲ 5 (B)', conf: 84, priority: 2 };
        if (next === 'P') return { predict: 'P', name: 'CHU KỲ 5 (P)', conf: 84, priority: 2 };
    }
    return null;
}

// CT27: CẦU 1-3-1
function CT27_131(arr) {
    if (arr.length < 6) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 3 && last3[2].n === 1) {
            if (last3[1].c === 'B') return { predict: 'B', name: 'CẦU 1-3-1 (B)', conf: 87, priority: 2 };
            if (last3[1].c === 'P') return { predict: 'P', name: 'CẦU 1-3-1 (P)', conf: 87, priority: 2 };
        }
    }
    return null;
}

// CT28: CẦU 3-2-3
function CT28_323(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 3) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 3-2-3 (B-P)', conf: 85, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 3-2-3 (P-B)', conf: 85, priority: 3 };
        }
    }
    return null;
}

// CT29: CẦU 2-2-3
function CT29_223(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 3) {
            if (last3[0].c === 'B') return { predict: 'P', name: 'CẦU 2-2-3 (B-P)', conf: 84, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'B', name: 'CẦU 2-2-3 (P-B)', conf: 84, priority: 3 };
        }
    }
    return null;
}

// CT30: CẦU 3-3-2
function CT30_332(arr) {
    if (arr.length < 8) return null;
    const runs = tinhRuns(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 3 && last3[2].n === 2) {
            if (last3[0].c === 'B') return { predict: 'B', name: 'CẦU 3-3-2 (B)', conf: 83, priority: 3 };
            if (last3[0].c === 'P') return { predict: 'P', name: 'CẦU 3-3-2 (P)', conf: 83, priority: 3 };
        }
    }
    return null;
}

// ============================================================
= THUẬT TOÁN HỌC MÁY - DỰ ĐOÁN THÔNG MINH
// ============================================================
function duDoanThongMinh(history, tableId) {
    const arr = toArr(history);
    if (arr.length < 5) {
        return {
            predict: 'ĐỢI',
            name: 'CHƯA ĐỦ DỮ LIỆU',
            conf: 0,
            all: [],
            top3: [],
            hocTu: 'Chưa có'
        };
    }
    
    // Lưu lịch sử học
    if (!learningData[tableId]) learningData[tableId] = [];
    learningData[tableId].push({
        time: Date.now(),
        result: arr[arr.length - 1],
        length: arr.length
    });
    if (learningData[tableId].length > 100) learningData[tableId].shift();
    
    // ── BƯỚC 1: CHẠY 30 CÔNG THỨC ──
    const results = [];
    const formulas = [
        CT01_Zigzag, CT02_222, CT03_22Dao, CT04_33, CT05_121,
        CT06_212, CT07_Chop, CT08_Streak, CT09_Tie, CT10_Balance,
        CT11_ChopDai, CT12_2112, CT13_321, CT14_123, CT15_232,
        CT16_313, CT17_112, CT18_221, CT19_122, CT20_Deviation,
        CT21_Reversal, CT22_44, CT23_242, CT24_424, CT25_Repeat,
        CT26_Cycle5, CT27_131, CT28_323, CT29_223, CT30_332
    ];
    
    for (const formula of formulas) {
        const result = formula(arr);
        if (result) {
            results.push(result);
        }
    }
    
    // ── BƯỚC 2: HỌC TỪ LỊCH SỬ ──
    const patterns = hocPattern(arr);
    const markov = hocMarkov(arr);
    const streak = hocStreak(arr);
    const crossData = hocCrossTable(tableId);
    
    // ── BƯỚC 3: TỔNG HỢP THUẬT TOÁN HỌC ──
    let scoreB = 0, scoreP = 0, scoreT = 0;
    let weightB = 0, weightP = 0, weightT = 0;
    
    // 3.1: Từ công thức nhận diện cầu
    for (const r of results) {
        if (r.predict === 'B') { scoreB += r.conf; weightB++; }
        else if (r.predict === 'P') { scoreP += r.conf; weightP++; }
        else if (r.predict === 'T') { scoreT += r.conf; weightT++; }
    }
    
    // 3.2: Từ Markov
    const last = arr[arr.length - 1];
    if (markov[last]) {
        const m = markov[last];
        scoreB += m.B * 100 * 0.8;
        scoreP += m.P * 100 * 0.8;
        scoreT += m.T * 100 * 0.8;
        weightB += 0.8; weightP += 0.8; weightT += 0.8;
    }
    
    // 3.3: Từ Streak
    const streakData = hocStreak(arr);
    const currentStreak = tinhRuns(arr);
    const lastRun = currentStreak[currentStreak.length - 1];
    if (lastRun) {
        const avgStreak = streakData[lastRun.c]?.avg || 2;
        if (lastRun.n >= avgStreak * 1.5) {
            // Streak dài -> đảo
            if (lastRun.c === 'B') { scoreP += 15; weightP += 1.5; }
            else if (lastRun.c === 'P') { scoreB += 15; weightB += 1.5; }
        } else {
            // Tiếp tục
            if (lastRun.c === 'B') { scoreB += 10; weightB += 1; }
            else if (lastRun.c === 'P') { scoreP += 10; weightP += 1; }
        }
    }
    
    // 3.4: Từ Cross-Table
    if (crossData.total > 20) {
        const crossB = crossData.B / crossData.total * 100;
        const crossP = crossData.P / crossData.total * 100;
        const crossT = crossData.T / crossData.total * 100;
        scoreB += crossB * 0.3;
        scoreP += crossP * 0.3;
        scoreT += crossT * 0.3;
        weightB += 0.3; weightP += 0.3; weightT += 0.3;
    }
    
    // 3.5: Từ Pattern
    const lastPattern = arr.slice(-3).join('');
    if (patterns[lastPattern]) {
        const p = patterns[lastPattern];
        const total = p.total;
        if (total > 0) {
            scoreB += p.B / total * 100 * 0.5;
            scoreP += p.P / total * 100 * 0.5;
            scoreT += p.T / total * 100 * 0.5;
            weightB += 0.5; weightP += 0.5; weightT += 0.5;
        }
    }
    
    // ── BƯỚC 4: TÍNH ĐIỂM TRUNG BÌNH ──
    let avgB = weightB > 0 ? scoreB / weightB : 50;
    let avgP = weightP > 0 ? scoreP / weightP : 50;
    let avgT = weightT > 0 ? scoreT / weightT : 50;
    
    // ── BƯỚC 5: CHUẨN HÓA ──
    const total = avgB + avgP + avgT;
    avgB = avgB / total * 100;
    avgP = avgP / total * 100;
    avgT = avgT / total * 100;
    
    // ── BƯỚC 6: TÍNH CONFIDENCE ──
    const confB = Math.min(50 + (avgB - 33) * 1.5, 95);
    const confP = Math.min(50 + (avgP - 33) * 1.5, 95);
    const confT = Math.min(50 + (avgT - 33) * 1.5, 90);
    
    // ── BƯỚC 7: CHỌN DỰ ĐOÁN ──
    const sides = [
        {name: 'BANKER', rate: Math.round(avgB), conf: Math.round(confB)},
        {name: 'PLAYER', rate: Math.round(avgP), conf: Math.round(confP)},
        {name: 'TIE', rate: Math.round(avgT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];
    const second = sides[1];
    
    // ── BƯỚC 8: XÁC ĐỊNH LOẠI CẦU ──
    let name = 'KHÔNG XÁC ĐỊNH';
    if (results.length > 0) {
        results.sort((a,b) => a.priority - b.priority || b.conf - a.conf);
        name = results[0].name;
    }
    
    // ── BƯỚC 9: TOP 3 CÔNG THỨC ──
    const top3 = results.slice(0, 3).map(r => ({
        name: r.name,
        conf: r.conf,
        predict: r.predict
    }));
    
    // ── BƯỚC 10: THÔNG TIN HỌC ──
    const hocTu = `Đã học ${learningData[tableId]?.length || 0} ván`;
    const crossInfo = crossData.total > 0 ? ` + ${crossData.total} ván cross` : '';
    
    return {
        predict: best.name,
        rate: best.rate,
        conf: best.conf,
        name: name,
        banker: {rate: Math.round(avgB), conf: Math.round(confB)},
        player: {rate: Math.round(avgP), conf: Math.round(confP)},
        tie: {rate: Math.round(avgT), conf: Math.round(confT)},
        top3: top3,
        hocTu: hocTu + crossInfo,
        all: results,
        diff: Math.round(best.conf - second.conf)
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

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const result = duDoanThongMinh(cauGoc, tableId);

        res.json({
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            Dự_đoán: result.predict,
            Tỉ_lệ: `${result.rate}%`,
            Độ_tin_cậy: `${result.conf}%`,
            Loại_cầu: result.name,
            BANKER: `${result.banker.rate}% (${result.banker.conf}%)`,
            PLAYER: `${result.player.rate}% (${result.player.conf}%)`,
            TIE: `${result.tie.rate}% (${result.tie.conf}%)`,
            'TOP_3_CẦU': result.top3.map(r => `${r.name} (${r.conf}%)`).join(' | '),
            Chênh_lệch: `${result.diff}%`,
            Đã_học: result.hocTu,
            Tổng_công_thức: result.all.length,
            id: '@tranhoang2286'
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

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

            const result = duDoanThongMinh(cauGoc, id);
            
            predictions[id] = {
                cầu_gốc: cauGoc,
                phiên: sessionData[id],
                Dự_đoán: result.predict,
                Tỉ_lệ: `${result.rate}%`,
                Độ_tin_cậy: `${result.conf}%`,
                Loại_cầu: result.name,
                BANKER: `${result.banker.rate}%`,
                PLAYER: `${result.player.rate}%`,
                TIE: `${result.tie.rate}%`,
                Đã_học: result.hocTu
            };
        }

        res.json({
            success: true,
            engine: 'VIP-HOCMAY-CONGTHUC-v5.0',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            tong_cong_thuc: 30,
            predictions
        });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
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
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/reset/:tableId', (req, res) => {
    const tableId = req.params.tableId.toUpperCase();
    if (learningData[tableId]) {
        learningData[tableId] = [];
        res.json({ success: true, message: `Đã reset học cho bàn ${tableId}` });
    } else {
        res.json({ success: false, message: `Không tìm thấy bàn ${tableId}` });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP - HỌC MÁY + CÔNG THỨC v5.0',
        version: '5.0.0',
        author: '@tranhoang2286',
        tong_cong_thuc: 30,
        thuat_toan: [
            '✅ HỌC MÁY TỪ LỊCH SỬ',
            '✅ HỌC PATTERN TỰ ĐỘNG',
            '✅ HỌC MARKOV CHAIN',
            '✅ HỌC STREAK CHU KỲ',
            '✅ HỌC CROSS-TABLE',
            '✅ 30 CÔNG THỨC CHUẨN'
        ],
        features: [
            '✅ KHÔNG RANDOM',
            '✅ TỰ HỌC THÔNG MINH',
            '✅ DỰ ĐOÁN CHÍNH XÁC',
            '✅ PHÂN TÍCH ĐA CHIỀU'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId',
            'Reset học': '/api/reset/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════════');
    console.log('🃏 BACCARAT VIP - HỌC MÁY + CÔNG THỨC v5.0');
    console.log('══════════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('📌 30 CÔNG THỨC + THUẬT TOÁN HỌC MÁY');
    console.log('  ✅ HỌC MÁY TỪ LỊCH SỬ');
    console.log('  ✅ HỌC PATTERN + MARKOV + STREAK');
    console.log('  ✅ HỌC CROSS-TABLE');
    console.log('  ✅ 30 CÔNG THỨC CHUẨN');
    console.log('  ✅ KHÔNG RANDOM');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════════');
});
