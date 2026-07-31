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
const patternHistory = {};

// ==================== HÀM TIỆN ÍCH NÂNG CẤP ====================

function toArr(str) {
    return str ? str.split('').filter(c => ['B','P','T'].includes(c)) : [];
}

function demTanSuat(arr) {
    const cnt = {B:0, P:0, T:0};
    for (const c of arr) if (cnt[c] !== undefined) cnt[c]++;
    const total = arr.length || 1;
    return {
        B: cnt.B / total * 100,
        P: cnt.P / total * 100,
        T: cnt.T / total * 100
    };
}

function timChuoi(arr) {
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
    const ts = demTanSuat(arr);
    const std = {B: 45.86, P: 44.62, T: 9.52};
    return {
        B: ts.B - std.B,
        P: ts.P - std.P,
        T: ts.T - std.T
    };
}

// ==================== CÔNG THỨC PHÂN TÍCH NÂNG CẤP ====================

// 1. Cầu Zigzag nâng cao
function CT1_ZigzagNangCao(arr) {
    if (arr.length < 6) return null;
    const last6 = arr.slice(-6);
    let zigzag = true;
    for (let i = 1; i < last6.length; i++) {
        if (last6[i] === last6[i-1] || last6[i] === 'T' || last6[i-1] === 'T') {
            zigzag = false;
            break;
        }
    }
    if (zigzag) {
        const last = last6[last6.length - 1];
        const conf = 94 + (arr.length > 20 ? 2 : 0);
        return { predict: last === 'B' ? 'P' : 'B', name: 'Zigzag nâng cao 6', conf: Math.min(conf, 98) };
    }
    return null;
}

// 2. Cầu 2-2-2 nâng cao
function CT2_222NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-2-2-2', conf: 93 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-2-2', conf: 90 };
        }
    }
    return null;
}

// 3. Cầu 3-3 nâng cao
function CT3_33NangCao(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 3 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-3-3', conf: 92 };
        }
    }
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-3', conf: 89 };
        }
    }
    return null;
}

// 4. Cầu 4-4 nâng cao
function CT4_44NangCao(arr) {
    if (arr.length < 12) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 4-4', conf: 91 };
        }
    }
    return null;
}

// 5. Cầu 1-2-1 nâng cao
function CT5_121NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[1].c, name: 'Cầu 1-2-1-2', conf: 93 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[1].c, name: 'Cầu 1-2-1', conf: 91 };
        }
    }
    return null;
}

// 6. Cầu 2-1-2 nâng cao
function CT6_212NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-2-1', conf: 92 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-2', conf: 87 };
        }
    }
    return null;
}

// 7. Cầu Chóp nâng cao
function CT7_ChopNangCao(arr) {
    if (arr.length < 10) return null;
    const recent = arr.slice(-10);
    const runs = timChuoi(recent);
    if (runs.every(r => r.n === 1) && runs.length >= 8) {
        const last = runs[runs.length - 1].c;
        const conf = 94 + (runs.length > 10 ? 2 : 0);
        return { predict: last === 'B' ? 'P' : 'B', name: 'Chop dài 10', conf: Math.min(conf, 97) };
    }
    return null;
}

// 8. Cầu Vệt nâng cao
function CT8_StreakNangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    const last = runs[runs.length - 1];
    if (last.n >= 6) {
        return { predict: last.c === 'B' ? 'P' : 'B', name: `Vệt ${last.c} x${last.n} Đảo`, conf: 85 };
    }
    if (last.n >= 4 && last.n <= 5) {
        return { predict: last.c, name: `Vệt ${last.c} x${last.n} Tiếp`, conf: 82 };
    }
    return null;
}

// 9. Cầu TIE nâng cao
function CT9_TieNangCao(arr) {
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
    if (lastGap > avgGap * 1.5 && avgGap < 20) {
        return { predict: 'T', name: `TIE Cycle (gap ${Math.round(avgGap)})`, conf: 84 };
    }
    // TIE theo mẫu
    if (tiePos.length >= 3) {
        const last3Gaps = [tiePos[1]-tiePos[0], tiePos[2]-tiePos[1]];
        if (last3Gaps[0] === last3Gaps[1] && last3Gaps[0] < 15) {
            return { predict: 'T', name: `TIE Pattern (gap ${last3Gaps[0]})`, conf: 86 };
        }
    }
    return null;
}

// 10. Cân bằng nâng cao
function CT10_BalanceNangCao(arr) {
    if (arr.length < 30) return null;
    const ts = demTanSuat(arr);
    const diff = ts.B - ts.P;
    // Phân tích theo biên độ
    if (diff > 18) return { predict: 'P', name: `Cân bằng (B hơn ${Math.round(diff)}%)`, conf: 88 };
    if (diff < -18) return { predict: 'B', name: `Cân bằng (P hơn ${Math.round(Math.abs(diff))}%)`, conf: 88 };
    if (diff > 12) return { predict: 'P', name: `Cân bằng nhẹ (B hơn ${Math.round(diff)}%)`, conf: 82 };
    if (diff < -12) return { predict: 'B', name: `Cân bằng nhẹ (P hơn ${Math.round(Math.abs(diff))}%)`, conf: 82 };
    return null;
}

// 11. Độ lệch chuẩn nâng cao
function CT11_DeviationNangCao(arr) {
    if (arr.length < 40) return null;
    const dev = tinhDoLech(arr);
    if (dev.B < -12) return { predict: 'B', name: `Deviation (B thiếu ${Math.round(Math.abs(dev.B))}%)`, conf: 84 };
    if (dev.P < -12) return { predict: 'P', name: `Deviation (P thiếu ${Math.round(Math.abs(dev.P))}%)`, conf: 84 };
    if (dev.T < -8) return { predict: 'T', name: `Deviation (T thiếu ${Math.round(Math.abs(dev.T))}%)`, conf: 78 };
    return null;
}

// 12. Cầu 3-2-1 nâng cao
function CT12_321NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1-2', conf: 90 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1', conf: 86 };
        }
    }
    return null;
}

// 13. Cầu 1-2-3 nâng cao
function CT13_123NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 1) {
            return { predict: last4[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-3-1', conf: 89 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            return { predict: last3[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-3', conf: 87 };
        }
    }
    return null;
}

// 14. Cầu 2-3-2 nâng cao
function CT14_232NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c, name: 'Cầu 2-3-2-3', conf: 91 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-3-2', conf: 88 };
        }
    }
    return null;
}

// 15. Cầu 3-1-3 nâng cao
function CT15_313NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-3-1', conf: 89 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-3', conf: 86 };
        }
    }
    return null;
}

// 16. Cầu 2-2-1 nâng cao
function CT16_221NangCao(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-2-1-2', conf: 89 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c, name: 'Cầu 2-2-1', conf: 84 };
        }
    }
    return null;
}

// 17. Cầu 1-1-2 nâng cao
function CT17_112NangCao(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-2-1', conf: 88 };
        }
    }
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-2', conf: 85 };
        }
    }
    return null;
}

// 18. Cầu 2-3-1 nâng cao
function CT18_231NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 1) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-3-1', conf: 86 };
        }
    }
    return null;
}

// 19. Cầu 1-3-2 nâng cao
function CT19_132NangCao(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 3 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-3-2', conf: 85 };
        }
    }
    return null;
}

// 20. Cầu Pattern kép nâng cao
function CT20_PatternKep(arr) {
    if (arr.length < 12) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 6) {
        const last6 = runs.slice(-6);
        const pattern = last6.map(r => r.n);
        // Pattern 1-2-1-2-1-2
        if (pattern.every((n, i) => n === (i % 2 === 0 ? 1 : 2))) {
            const last = last6[last6.length - 1].c;
            return { predict: last === 'B' ? 'P' : 'B', name: 'Pattern 1-2-1-2-1-2', conf: 94 };
        }
        // Pattern 2-1-2-1-2-1
        if (pattern.every((n, i) => n === (i % 2 === 0 ? 2 : 1))) {
            const last = last6[last6.length - 1].c;
            return { predict: last === 'B' ? 'P' : 'B', name: 'Pattern 2-1-2-1-2-1', conf: 94 };
        }
    }
    return null;
}

// ==================== HỌC CẦU NÂNG CAO ====================

function hocCau(arr) {
    if (arr.length < 10) return null;
    
    // Phân tích pattern lịch sử
    const patterns = [];
    for (let i = 0; i < arr.length - 4; i++) {
        patterns.push(arr.slice(i, i + 5).join(''));
    }
    
    // Tìm pattern gần nhất
    const last5 = arr.slice(-5).join('');
    let matches = 0;
    let nextPositions = {B: 0, P: 0, T: 0};
    
    for (let i = 0; i < patterns.length - 1; i++) {
        if (patterns[i] === last5) {
            const next = arr[i + 5];
            if (nextPositions[next] !== undefined) nextPositions[next]++;
            matches++;
        }
    }
    
    if (matches >= 2) {
        let max = 0;
        let predict = 'B';
        if (nextPositions.P > max) { max = nextPositions.P; predict = 'P'; }
        if (nextPositions.T > max && nextPositions.T > 0) { max = nextPositions.T; predict = 'T'; }
        if (max > 0) {
            const conf = Math.min(70 + max * 5, 92);
            return { predict: predict, name: `Học cầu (${matches} matches)`, conf: conf };
        }
    }
    return null;
}

// ==================== HÀM DỰ ĐOÁN CHÍNH NÂNG CẤP ====================

function duDoan(history) {
    const arr = toArr(history);
    if (arr.length < 5) {
        return {
            Du_doan: 'DOI',
            Ti_le: '0%',
            Do_tin_cay: '0%',
            Loai_cau: 'Chưa đủ dữ liệu',
            BANKER: '0%',
            PLAYER: '0%',
            TIE: '0%',
            So_cong_thuc: '0/20',
            Top_5_cau: 'Chưa có'
        };
    }

    const results = [];
    const formulas = [
        CT1_ZigzagNangCao, CT2_222NangCao, CT3_33NangCao, CT4_44NangCao,
        CT5_121NangCao, CT6_212NangCao, CT7_ChopNangCao, CT8_StreakNangCao,
        CT9_TieNangCao, CT10_BalanceNangCao, CT11_DeviationNangCao,
        CT12_321NangCao, CT13_123NangCao, CT14_232NangCao, CT15_313NangCao,
        CT16_221NangCao, CT17_112NangCao, CT18_231NangCao, CT19_132NangCao,
        CT20_PatternKep
    ];

    // Áp dụng tất cả công thức
    for (const formula of formulas) {
        const result = formula(arr);
        if (result) {
            results.push(result);
        }
    }

    // Học cầu
    const hocCauResult = hocCau(arr);
    if (hocCauResult) {
        results.push(hocCauResult);
    }

    // Nếu không có công thức nào khớp
    if (results.length === 0) {
        const ts = demTanSuat(arr);
        const max = Math.max(ts.B, ts.P, ts.T);
        let predict = 'B';
        let name = 'Tần suất B';
        if (ts.P === max) { predict = 'P'; name = 'Tần suất P'; }
        if (ts.T === max && ts.T > ts.B && ts.T > ts.P) { predict = 'T'; name = 'Tần suất T'; }
        
        return {
            Du_doan: predict === 'B' ? 'BANKER' : predict === 'P' ? 'PLAYER' : 'TIE',
            Ti_le: Math.round(max) + '%',
            Do_tin_cay: '60%',
            Loai_cau: name,
            BANKER: Math.round(ts.B) + '%',
            PLAYER: Math.round(ts.P) + '%',
            TIE: Math.round(ts.T) + '%',
            So_cong_thuc: '0/20',
            Top_5_cau: 'Không có'
        };
    }

    // Tính điểm ưu tiên
    let scoreB = 0, scoreP = 0, scoreT = 0;
    let countB = 0, countP = 0, countT = 0;
    let totalConf = 0;

    for (const r of results) {
        totalConf += r.conf;
        if (r.predict === 'B') { scoreB += r.conf; countB++; }
        else if (r.predict === 'P') { scoreP += r.conf; countP++; }
        else if (r.predict === 'T') { scoreT += r.conf; countT++; }
    }

    // Điều chỉnh trọng số dựa trên độ tin cậy
    let avgB = countB > 0 ? scoreB / countB : 25;
    let avgP = countP > 0 ? scoreP / countP : 25;
    let avgT = countT > 0 ? scoreT / countT : 5;

    // Áp dụng trọng số theo độ dài lịch sử
    const weight = Math.min(arr.length / 50, 1.2);
    avgB *= (1 + (arr.length > 30 ? 0.1 : 0));
    avgP *= (1 + (arr.length > 30 ? 0.1 : 0));
    avgT *= (1 + (arr.length > 30 ? 0.05 : 0));

    const total = avgB + avgP + avgT;
    avgB = avgB / total * 100;
    avgP = avgP / total * 100;
    avgT = avgT / total * 100;

    // Tính độ tin cậy tổng
    const baseConf = Math.min(55 + results.length * 1.5 + (arr.length > 20 ? 5 : 0), 96);
    const confB = Math.min(baseConf + (avgB - 33) * 1.3 + (countB > 2 ? 3 : 0), 97);
    const confP = Math.min(baseConf + (avgP - 33) * 1.3 + (countP > 2 ? 3 : 0), 97);
    const confT = Math.min(baseConf * 0.8 + (avgT - 33) * 1.0 + (countT > 1 ? 2 : 0), 90);

    const sides = [
        {name: 'BANKER', rate: Math.round(avgB), conf: Math.round(confB)},
        {name: 'PLAYER', rate: Math.round(avgP), conf: Math.round(confP)},
        {name: 'TIE', rate: Math.round(avgT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];

    // Lấy top 5 công thức
    results.sort((a,b) => b.conf - a.conf);
    const top5 = results.slice(0, 5).map((r, i) => `${i+1}.${r.name} (${r.conf}%)`).join(' | ');

    return {
        Du_doan: best.name,
        Ti_le: best.rate + '%',
        Do_tin_cay: best.conf + '%',
        Loai_cau: results[0]?.name || 'Không xác định',
        BANKER: Math.round(avgB) + '% (' + Math.round(confB) + '%)',
        PLAYER: Math.round(avgP) + '% (' + Math.round(confP) + '%)',
        TIE: Math.round(avgT) + '% (' + Math.round(confT) + '%)',
        So_cong_thuc: results.length + '/20',
        Top_5_cau: top5
    };
}

// ==================== LẤY DỮ LIỆU NÂNG CẤP ====================

async function fetchTableData(tableId) {
    try {
        const url = API_BASE + '/api/baccarat/' + tableId.toUpperCase();
        console.log('📡 ' + url);
        const res = await axios.get(url, { timeout: 15000 });
        if (res.data?.success && res.data?.data) return res.data.data.result || '';
        return '';
    } catch (e) {
        console.error('❌ ' + tableId + ':', e.message);
        return '';
    }
}

// ==================== API ENDPOINTS ====================

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const tableId = req.params.tableId.toUpperCase();
        const cauGoc = await fetchTableData(tableId);
        if (!cauGoc) {
            return res.json({ success: false, message: 'Không tìm thấy bàn ' + tableId });
        }

        const old = lastData[tableId] || '';
        const isNew = cauGoc !== old && cauGoc.length > old.length;
        lastData[tableId] = cauGoc;
        if (!sessionData[tableId]) sessionData[tableId] = 0;
        if (isNew) sessionData[tableId]++;

        const result = duDoan(cauGoc);

        res.json({
            success: true,
            phien: sessionData[tableId],
            cau_goc: cauGoc,
            Du_doan: result.Du_doan,
            Ti_le: result.Ti_le,
            Do_tin_cay: result.Do_tin_cay,
            Loai_cau: result.Loai_cau,
            BANKER: result.BANKER,
            PLAYER: result.PLAYER,
            TIE: result.TIE,
            So_cong_thuc: result.So_cong_thuc,
            Top_5_cau: result.Top_5_cau,
            engine: 'VIP-20-CONGTHUC-NANGCAO',
            author: '@tranhoang2286'
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

            const result = duDoan(cauGoc);
            
            predictions[id] = {
                phien: sessionData[id],
                Du_doan: result.Du_doan,
                Ti_le: result.Ti_le,
                Do_tin_cay: result.Do_tin_cay,
                Loai_cau: result.Loai_cau,
                BANKER: result.BANKER,
                PLAYER: result.PLAYER,
                TIE: result.TIE
            };
        }

        res.json({
            success: true,
            engine: 'VIP-20-CONGTHUC-NANGCAO',
            version: '2.0.0',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            tong_cong_thuc: 20,
            predictions: predictions
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
            res.json({ success: true, data: { table: tableId, result: result, shoeId: '', round: '' } });
        } else {
            res.json({ success: false, message: 'Không tìm thấy bàn ' + tableId });
        }
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP - 20 CÔNG THỨC NÂNG CAO',
        version: '2.0.0',
        author: '@tranhoang2286',
        tong_cong_thuc: 20,
        tinh_nang: [
            '20 công thức phân tích chuyên sâu',
            'Học cầu thông minh',
            'Tỷ lệ chuẩn xác cao',
            'Top 5 cầu mạnh nhất',
            'Dự đoán BCR'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  BACCARAT VIP - 20 CÔNG THỨC NÂNG CAO');
    console.log('========================================');
    console.log('🚀 http://localhost:' + PORT);
    console.log('👤 @tranhoang2286');
    console.log('📊 Engine: VIP-20-CONGTHUC-NANGCAO');
    console.log('========================================');
});
