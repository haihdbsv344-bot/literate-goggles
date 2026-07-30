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

// ============================================================
// HÀM TIỆN ÍCH NÂNG CAO
// ============================================================
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
        T: cnt.T / total * 100,
        count: cnt
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

function tinhXacSuat(arr, condition, target) {
    let count = 0, total = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        if (condition(arr, i)) {
            total++;
            if (arr[i+1] === target) count++;
        }
    }
    return total > 0 ? count / total * 100 : 0;
}

// ============================================================
= 100 CÔNG THỨC NHẬN DIỆN CẦU - TỪ CAO THỦ THẾ GIỚI
// ============================================================

// ============================================================
// PHẦN 1: CẦU CƠ BẢN - 20 CÔNG THỨC (CT1-CT20)
// ============================================================

// CT1: Cầu 1-1 Zigzag (Chuẩn cao thủ Macau)
function CT1_Zigzag(arr) {
    if (arr.length < 4) return null;
    const last4 = arr.slice(-4);
    if (last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1]) {
        return { predict: last4[0] === 'B' ? 'P' : 'B', name: 'Cầu 1-1 Zigzag (Macau)', conf: 93 };
    }
    return null;
}

// CT2: Cầu 2-2-2 (Cầu đôi chuẩn)
function CT2_222(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-2-2 (Đôi chuẩn)', conf: 91 };
        }
    }
    return null;
}

// CT3: Cầu 2-2 Đảo (Cầu đôi đảo)
function CT3_22Dao(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[1].n === 2 && last3[2].n === 2 && last3[1].c !== last3[2].c) {
            return { predict: last3[1].c, name: 'Cầu 2-2 Đảo', conf: 89 };
        }
    }
    return null;
}

// CT4: Cầu 3-3 (Cầu ba chuẩn)
function CT4_33(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 3 && last2[1].n === 3) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-3 (Ba chuẩn)', conf: 90 };
        }
    }
    return null;
}

// CT5: Cầu 1-2-1 (Cầu tam giác)
function CT5_121(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[1].c, name: 'Cầu 1-2-1 (Tam giác)', conf: 92 };
        }
    }
    return null;
}

// CT6: Cầu 2-1-2 (Cầu tam giác đảo)
function CT6_212(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-2 (Tam giác đảo)', conf: 88 };
        }
    }
    return null;
}

// CT7: Cầu Chop (Cầu đảo liên tục)
function CT7_Chop(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    let switches = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i] !== recent[i-1] && recent[i] !== 'T' && recent[i-1] !== 'T') {
            switches++;
        }
    }
    if (switches / 7 >= 0.7) {
        const last = recent[recent.length - 1];
        return { predict: last === 'B' ? 'P' : 'B', name: 'Cầu Chop (Đảo liên tục)', conf: 89 };
    }
    return null;
}

// CT8: Cầu Streak (Cầu bệt)
function CT8_Streak(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    const last = runs[runs.length - 1];
    if (last.n >= 5) {
        return { predict: last.c === 'B' ? 'P' : 'B', name: `Cầu bệt ${last.c} x${last.n}`, conf: 83 };
    }
    if (last.n >= 3 && last.n <= 4) {
        return { predict: last.c, name: `Cầu bệt ${last.c} x${last.n} (tiếp)`, conf: 79 };
    }
    return null;
}

// CT9: Cầu Tie (Cầu hòa)
function CT9_Tie(arr) {
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
        return { predict: 'T', name: `Cầu Tie (gap ${Math.round(avgGap)})`, conf: 83 };
    }
    return null;
}

// CT10: Cầu Cân bằng (Balance)
function CT10_Balance(arr) {
    if (arr.length < 20) return null;
    const ts = demTanSuat(arr);
    const diff = ts.B - ts.P;
    if (diff > 15) return { predict: 'P', name: `Cầu cân bằng (B thừa ${Math.round(diff)}%)`, conf: 86 };
    if (diff < -15) return { predict: 'B', name: `Cầu cân bằng (P thừa ${Math.round(Math.abs(diff))}%)`, conf: 86 };
    return null;
}

// CT11: Cầu 1-1-1-1 (Chop dài)
function CT11_ChopDai(arr) {
    if (arr.length < 8) return null;
    const recent = arr.slice(-8);
    const runs = timChuoi(recent);
    if (runs.every(r => r.n === 1) && runs.length >= 6) {
        const last = runs[runs.length - 1].c;
        return { predict: last === 'B' ? 'P' : 'B', name: 'Cầu 1-1-1-1 (Chop dài)', conf: 91 };
    }
    return null;
}

// CT12: Cầu 2-1-1-2 (Cầu zigzag kép)
function CT12_2112(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-1-1-2 (Zigzag kép)', conf: 90 };
        }
    }
    return null;
}

// CT13: Cầu 3-2-1 (Cầu giảm dần)
function CT13_321(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1 (Giảm dần)', conf: 87 };
        }
    }
    return null;
}

// CT14: Cầu 1-2-3 (Cầu tăng dần)
function CT14_123(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 2 && last3[2].n === 3) {
            return { predict: last3[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-3 (Tăng dần)', conf: 88 };
        }
    }
    return null;
}

// CT15: Cầu 2-3-2 (Cầu đối xứng)
function CT15_232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 3 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-3-2 (Đối xứng)', conf: 89 };
        }
    }
    return null;
}

// CT16: Cầu 3-1-3 (Cầu đối xứng lớn)
function CT16_313(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-3 (Đối xứng lớn)', conf: 87 };
        }
    }
    return null;
}

// CT17: Cầu 1-1-2 (Cầu leo)
function CT17_112(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-2 (Leo)', conf: 86 };
        }
    }
    return null;
}

// CT18: Cầu 2-2-1 (Cầu xuống)
function CT18_221(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 1) {
            return { predict: last3[0].c, name: 'Cầu 2-2-1 (Xuống)', conf: 85 };
        }
    }
    return null;
}

// CT19: Cầu 4-4 (Cầu 4)
function CT19_44(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 4 && last2[1].n === 4) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 4-4', conf: 85 };
        }
    }
    return null;
}

// CT20: Cầu Deviation (Độ lệch chuẩn)
function CT20_Deviation(arr) {
    if (arr.length < 30) return null;
    const ts = demTanSuat(arr);
    const std = {B: 45.86, P: 44.62, T: 9.52};
    const devB = ts.B - std.B;
    const devP = ts.P - std.P;
    const devT = ts.T - std.T;
    
    if (devB < -10) return { predict: 'B', name: `Deviation (B thiếu ${Math.round(Math.abs(devB))}%)`, conf: 81 };
    if (devP < -10) return { predict: 'P', name: `Deviation (P thiếu ${Math.round(Math.abs(devP))}%)`, conf: 81 };
    if (devT < -7) return { predict: 'T', name: `Deviation (T thiếu ${Math.round(Math.abs(devT))}%)`, conf: 77 };
    return null;
}

// ============================================================
// PHẦN 2: CẦU BIẾN THỂ - 20 CÔNG THỨC (CT21-CT40)
// ============================================================

// CT21: Cầu 1-3-1 (Cầu đặc biệt)
function CT21_131(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 3 && last3[2].n === 1) {
            return { predict: last3[1].c, name: 'Cầu 1-3-1 (Đặc biệt)', conf: 88 };
        }
    }
    return null;
}

// CT22: Cầu 3-2-3 (Cầu đặc biệt)
function CT22_323(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 2 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-3 (Đặc biệt)', conf: 86 };
        }
    }
    return null;
}

// CT23: Cầu 2-2-3 (Cầu leo dài)
function CT23_223(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 2 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-2-3 (Leo dài)', conf: 85 };
        }
    }
    return null;
}

// CT24: Cầu 3-3-2 (Cầu xuống dài)
function CT24_332(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 3 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 3-3-2 (Xuống dài)', conf: 84 };
        }
    }
    return null;
}

// CT25: Cầu 2-4-2 (Cầu trung)
function CT25_242(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 4 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-4-2 (Trung)', conf: 86 };
        }
    }
    return null;
}

// CT26: Cầu 4-2-4 (Cầu trung đảo)
function CT26_424(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 4 && last3[1].n === 2 && last3[2].n === 4) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 4-2-4 (Trung đảo)', conf: 84 };
        }
    }
    return null;
}

// CT27: Cầu 1-4-1 (Cầu dài)
function CT27_141(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 1 && last3[1].n === 4 && last3[2].n === 1) {
            return { predict: last3[1].c, name: 'Cầu 1-4-1 (Dài)', conf: 85 };
        }
    }
    return null;
}

// CT28: Cầu 4-1-4 (Cầu dài đảo)
function CT28_414(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 4 && last3[1].n === 1 && last3[2].n === 4) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 4-1-4 (Dài đảo)', conf: 83 };
        }
    }
    return null;
}

// CT29: Cầu 2-1-3 (Cầu pha)
function CT29_213(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 1 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-3 (Pha)', conf: 84 };
        }
    }
    return null;
}

// CT30: Cầu 3-1-2 (Cầu pha đảo)
function CT30_312(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 1 && last3[2].n === 2) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-2 (Pha đảo)', conf: 84 };
        }
    }
    return null;
}

// CT31: Cầu 1-2-1-2 (Cầu zigzag kép)
function CT31_1212(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-1-2 (Zigzag kép)', conf: 87 };
        }
    }
    return null;
}

// CT32: Cầu 2-1-2-1 (Cầu zigzag kép đảo)
function CT32_2121(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[0].c, name: 'Cầu 2-1-2-1 (Zigzag kép đảo)', conf: 86 };
        }
    }
    return null;
}

// CT33: Cầu 1-1-1-2 (Cầu lệch)
function CT33_1112(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-1-2 (Lệch)', conf: 84 };
        }
    }
    return null;
}

// CT34: Cầu 2-1-1-1 (Cầu lệch đảo)
function CT34_2111(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-1-1 (Lệch đảo)', conf: 83 };
        }
    }
    return null;
}

// CT35: Cầu 1-2-2-1 (Cầu đối xứng lệch)
function CT35_1221(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[1].c, name: 'Cầu 1-2-2-1 (Đối xứng lệch)', conf: 85 };
        }
    }
    return null;
}

// CT36: Cầu 2-2-1-1 (Cầu đối xứng lệch đảo)
function CT36_2211(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c, name: 'Cầu 2-2-1-1 (Đối xứng lệch đảo)', conf: 84 };
        }
    }
    return null;
}

// CT37: Cầu 3-1-2-1 (Cầu pha kép)
function CT37_3121(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-2-1 (Pha kép)', conf: 85 };
        }
    }
    return null;
}

// CT38: Cầu 1-3-2-1 (Cầu pha kép đảo)
function CT38_1321(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-3-2-1 (Pha kép đảo)', conf: 84 };
        }
    }
    return null;
}

// CT39: Cầu 2-3-1-2 (Cầu pha kép trung)
function CT39_2312(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-3-1-2 (Pha kép trung)', conf: 85 };
        }
    }
    return null;
}

// CT40: Cầu 3-2-1-2 (Cầu pha kép trung đảo)
function CT40_3212(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1-2 (Pha kép trung đảo)', conf: 84 };
        }
    }
    return null;
}

// ============================================================
// PHẦN 3: CẦU NÂNG CAO - 30 CÔNG THỨC (CT41-CT70)
// ============================================================

// CT41: Pattern 5 ván lặp (Cao thủ Singapore)
function CT41_Pattern5(arr) {
    if (arr.length < 12) return null;
    const last5 = arr.slice(-5).join('');
    const prev5 = arr.slice(-10, -5).join('');
    let match = 0;
    for (let i = 0; i < 5; i++) {
        if (last5[i] === prev5[i]) match++;
    }
    if (match >= 4) {
        const next = arr[arr.length - 5];
        if (next === 'B') return { predict: 'B', name: 'Pattern 5 lặp (Singapore)', conf: 87 };
        if (next === 'P') return { predict: 'P', name: 'Pattern 5 lặp (Singapore)', conf: 87 };
        if (next === 'T') return { predict: 'T', name: 'Pattern 5 lặp (Singapore)', conf: 81 };
    }
    return null;
}

// CT42: Chu kỳ 3 (Cao thủ Macau)
function CT42_Cycle3(arr) {
    if (arr.length < 9) return null;
    const last3 = arr.slice(-3);
    const prev3 = arr.slice(-6, -3);
    const prev33 = arr.slice(-9, -6);
    if (last3.join('') === prev3.join('') && prev3.join('') === prev33.join('')) {
        const next = arr[arr.length - 3];
        if (next === 'B') return { predict: 'B', name: 'Chu kỳ 3 (Macau)', conf: 86 };
        if (next === 'P') return { predict: 'P', name: 'Chu kỳ 3 (Macau)', conf: 86 };
    }
    return null;
}

// CT43: Chu kỳ 4 (Cao thủ Vegas)
function CT43_Cycle4(arr) {
    if (arr.length < 12) return null;
    const last4 = arr.slice(-4);
    const prev4 = arr.slice(-8, -4);
    const prev44 = arr.slice(-12, -8);
    if (last4.join('') === prev4.join('') && prev4.join('') === prev44.join('')) {
        const next = arr[arr.length - 4];
        if (next === 'B') return { predict: 'B', name: 'Chu kỳ 4 (Vegas)', conf: 85 };
        if (next === 'P') return { predict: 'P', name: 'Chu kỳ 4 (Vegas)', conf: 85 };
    }
    return null;
}

// CT44: Cầu 5-5 (Cao thủ London)
function CT44_55(arr) {
    if (arr.length < 12) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 5 && last2[1].n === 5) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 5-5 (London)', conf: 83 };
        }
    }
    return null;
}

// CT45: Cầu 6-6 (Cao thủ Monaco)
function CT45_66(arr) {
    if (arr.length < 14) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 2) {
        const last2 = runs.slice(-2);
        if (last2[0].n === 6 && last2[1].n === 6) {
            return { predict: last2[0].c === 'B' ? 'P' : 'B', name: 'Cầu 6-6 (Monaco)', conf: 81 };
        }
    }
    return null;
}

// CT46: Cầu 3-4-3 (Cao thủ Paris)
function CT46_343(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 4 && last3[2].n === 3) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-4-3 (Paris)', conf: 85 };
        }
    }
    return null;
}

// CT47: Cầu 4-3-4 (Cao thủ Dubai)
function CT47_434(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 4 && last3[1].n === 3 && last3[2].n === 4) {
            return { predict: last3[0].c, name: 'Cầu 4-3-4 (Dubai)', conf: 84 };
        }
    }
    return null;
}

// CT48: Cầu 2-5-2 (Cao thủ Tokyo)
function CT48_252(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 2 && last3[1].n === 5 && last3[2].n === 2) {
            return { predict: last3[0].c, name: 'Cầu 2-5-2 (Tokyo)', conf: 83 };
        }
    }
    return null;
}

// CT49: Cầu 5-2-5 (Cao thủ Seoul)
function CT49_525(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 5 && last3[1].n === 2 && last3[2].n === 5) {
            return { predict: last3[0].c === 'B' ? 'P' : 'B', name: 'Cầu 5-2-5 (Seoul)', conf: 82 };
        }
    }
    return null;
}

// CT50: Cầu Long (Bệt dài) - Cao thủ Hồng Kông
function CT50_Long(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    const last = runs[runs.length - 1];
    if (last.n >= 7) {
        if (last.c === 'B') return { predict: 'P', name: `Cầu Long B x${last.n} (HK)`, conf: 80 };
        if (last.c === 'P') return { predict: 'B', name: `Cầu Long P x${last.n} (HK)`, conf: 80 };
    }
    if (last.n >= 10) {
        if (last.c === 'B') return { predict: 'P', name: `Siêu Long B x${last.n} (HK)`, conf: 75 };
        if (last.c === 'P') return { predict: 'B', name: `Siêu Long P x${last.n} (HK)`, conf: 75 };
    }
    return null;
}

// CT51: Cầu Đôi 3-3-3 (Cao thủ Đài Loan)
function CT51_333(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 3) {
        const last3 = runs.slice(-3);
        if (last3[0].n === 3 && last3[1].n === 3 && last3[2].n === 3) {
            return { predict: last3[0].c, name: 'Cầu 3-3-3 (Đài Loan)', conf: 88 };
        }
    }
    return null;
}

// CT52: Cầu 2-2-2-2 (Cao thủ Singapore)
function CT52_2222(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-2-2-2 (Singapore)', conf: 87 };
        }
    }
    return null;
}

// CT53: Cầu 1-1-1-1-1 (Chop siêu dài)
function CT53_11111(arr) {
    if (arr.length < 12) return null;
    const recent = arr.slice(-10);
    const runs = timChuoi(recent);
    if (runs.every(r => r.n === 1) && runs.length >= 8) {
        const last = runs[runs.length - 1].c;
        return { predict: last === 'B' ? 'P' : 'B', name: 'Chop siêu dài 1-1-1-1-1', conf: 89 };
    }
    return null;
}

// CT54: Cầu 1-2-3-2 (Cao thủ Malaysia)
function CT54_1232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 2) {
            return { predict: last4[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-3-2 (Malaysia)', conf: 86 };
        }
    }
    return null;
}

// CT55: Cầu 2-3-2-3 (Cao thủ Macau)
function CT55_2323(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-3-2-3 (Macau)', conf: 85 };
        }
    }
    return null;
}

// CT56: Cầu 3-2-3-2 (Cao thủ Vegas)
function CT56_3232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 3-2-3-2 (Vegas)', conf: 84 };
        }
    }
    return null;
}

// CT57: Cầu 1-2-1-3 (Cao thủ London)
function CT57_1213(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 3) {
            return { predict: last4[1].c, name: 'Cầu 1-2-1-3 (London)', conf: 84 };
        }
    }
    return null;
}

// CT58: Cầu 3-1-2-3 (Cao thủ Dubai)
function CT58_3123(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-2-3 (Dubai)', conf: 83 };
        }
    }
    return null;
}

// CT59: Cầu 2-1-2-3 (Cao thủ Tokyo)
function CT59_2123(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c, name: 'Cầu 2-1-2-3 (Tokyo)', conf: 83 };
        }
    }
    return null;
}

// CT60: Cầu 1-3-2-3 (Cao thủ Seoul)
function CT60_1323(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-3-2-3 (Seoul)', conf: 83 };
        }
    }
    return null;
}

// CT61: Cầu 2-2-3-2 (Cao thủ Paris)
function CT61_2232(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-2-3-2 (Paris)', conf: 83 };
        }
    }
    return null;
}

// CT62: Cầu 3-2-2-3 (Cao thủ Monaco)
function CT62_3223(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c, name: 'Cầu 3-2-2-3 (Monaco)', conf: 82 };
        }
    }
    return null;
}

// CT63: Cầu 1-1-3-1 (Cao thủ Hồng Kông)
function CT63_1131(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-3-1 (HK)', conf: 82 };
        }
    }
    return null;
}

// CT64: Cầu 3-1-1-3 (Cao thủ Đài Loan)
function CT64_3113(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-1-3 (Đài Loan)', conf: 81 };
        }
    }
    return null;
}

// CT65: Cầu 2-2-1-2 (Cao thủ Singapore)
function CT65_2212(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-2-1-2 (Singapore)', conf: 82 };
        }
    }
    return null;
}

// CT66: Cầu 1-2-2-3 (Cao thủ Malaysia)
function CT66_1223(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-2-2-3 (Malaysia)', conf: 82 };
        }
    }
    return null;
}

// CT67: Cầu 3-2-1-3 (Cao thủ Macau)
function CT67_3213(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1-3 (Macau)', conf: 82 };
        }
    }
    return null;
}

// CT68: Cầu 1-3-1-2 (Cao thủ Vegas)
function CT68_1312(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 3 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[1].c, name: 'Cầu 1-3-1-2 (Vegas)', conf: 82 };
        }
    }
    return null;
}

// CT69: Cầu 2-1-3-2 (Cao thủ London)
function CT69_2132(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-1-3-2 (London)', conf: 81 };
        }
    }
    return null;
}

// CT70: Cầu 3-1-3-2 (Cao thủ Dubai)
function CT70_3132(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-3-2 (Dubai)', conf: 81 };
        }
    }
    return null;
}

// ============================================================
// PHẦN 4: CẦU SIÊU VIP - 30 CÔNG THỨC (CT71-CT100)
// ============================================================

// CT71: Cầu Đảo chiều B-P (Cao thủ thế giới)
function CT71_DaoChieu(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 5) {
        const last5 = runs.slice(-5);
        // Pattern: 3-2-3-2-3 (đảo chiều liên tục)
        if (last5[0].c !== last5[1].c && last5[1].c !== last5[2].c && 
            last5[2].c !== last5[3].c && last5[3].c !== last5[4].c) {
            return { predict: last5[4].c === 'B' ? 'P' : 'B', name: 'Cầu đảo chiều liên tục', conf: 86 };
        }
    }
    return null;
}

// CT72: Cầu 2-1-1-1-2 (Cao thủ Châu Á)
function CT72_21112(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 5) {
        const last5 = runs.slice(-5);
        if (last5[0].n === 2 && last5[1].n === 1 && last5[2].n === 1 && 
            last5[3].n === 1 && last5[4].n === 2) {
            return { predict: last5[0].c, name: 'Cầu 2-1-1-1-2 (Châu Á)', conf: 87 };
        }
    }
    return null;
}

// CT73: Cầu 1-2-2-2-1 (Cao thủ Âu Mỹ)
function CT73_12221(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 5) {
        const last5 = runs.slice(-5);
        if (last5[0].n === 1 && last5[1].n === 2 && last5[2].n === 2 && 
            last5[3].n === 2 && last5[4].n === 1) {
            return { predict: last5[1].c, name: 'Cầu 1-2-2-2-1 (Âu Mỹ)', conf: 86 };
        }
    }
    return null;
}

// CT74: Cầu 3-1-1-1-3 (Cao thủ Hàn Quốc)
function CT74_31113(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 5) {
        const last5 = runs.slice(-5);
        if (last5[0].n === 3 && last5[1].n === 1 && last5[2].n === 1 && 
            last5[3].n === 1 && last5[4].n === 3) {
            return { predict: last5[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-1-1-3 (Hàn Quốc)', conf: 85 };
        }
    }
    return null;
}

// CT75: Cầu 1-3-3-3-1 (Cao thủ Nhật Bản)
function CT75_13331(arr) {
    if (arr.length < 10) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 5) {
        const last5 = runs.slice(-5);
        if (last5[0].n === 1 && last5[1].n === 3 && last5[2].n === 3 && 
            last5[3].n === 3 && last5[4].n === 1) {
            return { predict: last5[1].c, name: 'Cầu 1-3-3-3-1 (Nhật Bản)', conf: 84 };
        }
    }
    return null;
}

// CT76: Cầu 2-2-2-3 (Cao thủ Trung Quốc)
function CT76_2223(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-2-2-3 (Trung Quốc)', conf: 84 };
        }
    }
    return null;
}

// CT77: Cầu 3-2-2-2 (Cao thủ Đài Loan)
function CT77_3222(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 3-2-2-2 (Đài Loan)', conf: 83 };
        }
    }
    return null;
}

// CT78: Cầu 1-1-2-2 (Cao thủ Singapore)
function CT78_1122(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-2-2 (Singapore)', conf: 84 };
        }
    }
    return null;
}

// CT79: Cầu 2-2-1-1 (Cao thủ Malaysia)
function CT79_2211(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c, name: 'Cầu 2-2-1-1 (Malaysia)', conf: 83 };
        }
    }
    return null;
}

// CT80: Cầu 1-1-3-3 (Cao thủ Macau)
function CT80_1133(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 3 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-3-3 (Macau)', conf: 83 };
        }
    }
    return null;
}

// CT81: Cầu 3-3-1-1 (Cao thủ Vegas)
function CT81_3311(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 3 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c, name: 'Cầu 3-3-1-1 (Vegas)', conf: 82 };
        }
    }
    return null;
}

// CT82: Cầu 1-2-3-1 (Cao thủ London)
function CT82_1231(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 1) {
            return { predict: last4[1].c, name: 'Cầu 1-2-3-1 (London)', conf: 84 };
        }
    }
    return null;
}

// CT83: Cầu 3-1-2-2 (Cao thủ Dubai)
function CT83_3122(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-2-2 (Dubai)', conf: 83 };
        }
    }
    return null;
}

// CT84: Cầu 2-2-3-3 (Cao thủ Tokyo)
function CT84_2233(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-2-3-3 (Tokyo)', conf: 83 };
        }
    }
    return null;
}

// CT85: Cầu 3-3-2-2 (Cao thủ Seoul)
function CT85_3322(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 3-3-2-2 (Seoul)', conf: 82 };
        }
    }
    return null;
}

// CT86: Cầu 1-1-2-3 (Cao thủ Paris)
function CT86_1123(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-2-3 (Paris)', conf: 83 };
        }
    }
    return null;
}

// CT87: Cầu 3-2-1-1 (Cao thủ Monaco)
function CT87_3211(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-1-1 (Monaco)', conf: 82 };
        }
    }
    return null;
}

// CT88: Cầu 1-3-2-2 (Cao thủ Hồng Kông)
function CT88_1322(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[1].c === 'B' ? 'P' : 'B', name: 'Cầu 1-3-2-2 (HK)', conf: 82 };
        }
    }
    return null;
}

// CT89: Cầu 2-1-1-3 (Cao thủ Đài Loan)
function CT89_2113(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-1-1-3 (Đài Loan)', conf: 82 };
        }
    }
    return null;
}

// CT90: Cầu 3-1-1-2 (Cao thủ Singapore)
function CT90_3112(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 2) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-1-2 (Singapore)', conf: 81 };
        }
    }
    return null;
}

// CT91: Cầu 1-2-2-2 (Cao thủ Malaysia)
function CT91_1222(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 2) {
            return { predict: last4[1].c, name: 'Cầu 1-2-2-2 (Malaysia)', conf: 83 };
        }
    }
    return null;
}

// CT92: Cầu 2-2-2-1 (Cao thủ Macau)
function CT92_2221(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 2 && last4[2].n === 2 && last4[3].n === 1) {
            return { predict: last4[0].c, name: 'Cầu 2-2-2-1 (Macau)', conf: 82 };
        }
    }
    return null;
}

// CT93: Cầu 3-3-2-3 (Cao thủ Vegas)
function CT93_3323(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 3 && last4[2].n === 2 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-3-2-3 (Vegas)', conf: 82 };
        }
    }
    return null;
}

// CT94: Cầu 2-3-3-2 (Cao thủ London)
function CT94_2332(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 3 && last4[3].n === 2) {
            return { predict: last4[0].c, name: 'Cầu 2-3-3-2 (London)', conf: 82 };
        }
    }
    return null;
}

// CT95: Cầu 3-2-3-3 (Cao thủ Dubai)
function CT95_3233(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 2 && last4[2].n === 3 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-2-3-3 (Dubai)', conf: 81 };
        }
    }
    return null;
}

// CT96: Cầu 1-1-1-3 (Cao thủ Tokyo)
function CT96_1113(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 3) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 1-1-1-3 (Tokyo)', conf: 82 };
        }
    }
    return null;
}

// CT97: Cầu 3-1-1-1 (Cao thủ Seoul)
function CT97_3111(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 3 && last4[1].n === 1 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 3-1-1-1 (Seoul)', conf: 81 };
        }
    }
    return null;
}

// CT98: Cầu 2-3-1-1 (Cao thủ Paris)
function CT98_2311(arr) {
    if (arr.length < 8) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 2 && last4[1].n === 3 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[0].c === 'B' ? 'P' : 'B', name: 'Cầu 2-3-1-1 (Paris)', conf: 81 };
        }
    }
    return null;
}

// CT99: Cầu 1-3-1-1 (Cao thủ Monaco)
function CT99_1311(arr) {
    if (arr.length < 6) return null;
    const runs = timChuoi(arr);
    if (runs.length >= 4) {
        const last4 = runs.slice(-4);
        if (last4[0].n === 1 && last4[1].n === 3 && last4[2].n === 1 && last4[3].n === 1) {
            return { predict: last4[1].c, name: 'Cầu 1-3-1-1 (Monaco)', conf: 81 };
        }
    }
    return null;
}

// CT100: Tổng hợp đa cầu siêu VIP
function CT100_TongHop(arr) {
    if (arr.length < 10) return null;
    const ts = demTanSuat(arr);
    const runs = timChuoi(arr);
    const lastRun = runs[runs.length - 1];
    const dev = {B: ts.B - 45.86, P: ts.P - 44.62, T: ts.T - 9.52};
    
    let scoreB = 0, scoreP = 0, scoreT = 0;
    let weightB = 0, weightP = 0, weightT = 0;
    
    // 1. Tần suất
    scoreB += ts.B * 0.3; weightB += 0.3;
    scoreP += ts.P * 0.3; weightP += 0.3;
    scoreT += ts.T * 0.3; weightT += 0.3;
    
    // 2. Độ lệch
    if (dev.B < -5) { scoreB += 12; weightB += 0.25; }
    if (dev.P < -5) { scoreP += 12; weightP += 0.25; }
    if (dev.T < -3) { scoreT += 10; weightT += 0.25; }
    
    // 3. Streak
    if (lastRun) {
        if (lastRun.c === 'B') {
            if (lastRun.n >= 3) { scoreP += 15; weightP += 0.3; }
            else { scoreB += 8; weightB += 0.2; }
        } else if (lastRun.c === 'P') {
            if (lastRun.n >= 3) { scoreB += 15; weightB += 0.3; }
            else { scoreP += 8; weightP += 0.2; }
        }
    }
    
    // 4. Markov
    let bToB = 0, bToP = 0, bToT = 0;
    let pToB = 0, pToP = 0, pToT = 0;
    let bCount = 0, pCount = 0;
    for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === 'B') {
            bCount++;
            if (arr[i+1] === 'B') bToB++;
            else if (arr[i+1] === 'P') bToP++;
            else bToT++;
        } else if (arr[i] === 'P') {
            pCount++;
            if (arr[i+1] === 'B') pToB++;
            else if (arr[i+1] === 'P') pToP++;
            else pToT++;
        }
    }
    
    const last = arr[arr.length - 1];
    if (last === 'B' && bCount > 0) {
        const pB = bToB / bCount * 100;
        const pP = bToP / bCount * 100;
        const pT = bToT / bCount * 100;
        if (pB > pP && pB > pT) { scoreB += pB * 0.2; weightB += 0.2; }
        else if (pP > pB && pP > pT) { scoreP += pP * 0.2; weightP += 0.2; }
        else if (pT > 20) { scoreT += pT * 0.2; weightT += 0.2; }
    } else if (last === 'P' && pCount > 0) {
        const pB = pToB / pCount * 100;
        const pP = pToP / pCount * 100;
        const pT = pToT / pCount * 100;
        if (pB > pP && pB > pT) { scoreB += pB * 0.2; weightB += 0.2; }
        else if (pP > pB && pP > pT) { scoreP += pP * 0.2; weightP += 0.2; }
        else if (pT > 20) { scoreT += pT * 0.2; weightT += 0.2; }
    }
    
    // Tính điểm trung bình
    let avgB = weightB > 0 ? scoreB / weightB : 40;
    let avgP = weightP > 0 ? scoreP / weightP : 40;
    let avgT = weightT > 0 ? scoreT / weightT : 10;
    
    const total = avgB + avgP + avgT;
    avgB = avgB / total * 100;
    avgP = avgP / total * 100;
    avgT = avgT / total * 100;
    
    const max = Math.max(avgB, avgP, avgT);
    if (max === avgB && max > 45) return { predict: 'B', name: 'Tổng hợp siêu VIP (B)', conf: Math.round(max) };
    if (max === avgP && max > 45) return { predict: 'P', name: 'Tổng hợp siêu VIP (P)', conf: Math.round(max) };
    if (max === avgT && max > 20) return { predict: 'T', name: 'Tổng hợp siêu VIP (T)', conf: Math.round(max) };
    return null;
}

// ============================================================
= THUẬT TOÁN TỔNG HỢP 100 CÔNG THỨC
// ============================================================
function duDoanSieuVIP(history) {
    const arr = toArr(history);
    if (arr.length < 5) {
        return {
            Dự_đoán: 'ĐỢI',
            Tỉ_lệ: '0%',
            Độ_tin_cậy: '0%',
            Loại_cầu: 'Chưa đủ dữ liệu',
            BANKER: '0%',
            PLAYER: '0%',
            TIE: '0%'
        };
    }

    // Chạy 100 công thức
    const results = [];
    const formulas = [
        CT1_Zigzag, CT2_222, CT3_22Dao, CT4_33, CT5_121,
        CT6_212, CT7_Chop, CT8_Streak, CT9_Tie, CT10_Balance,
        CT11_ChopDai, CT12_2112, CT13_321, CT14_123, CT15_232,
        CT16_313, CT17_112, CT18_221, CT19_44, CT20_Deviation,
        CT21_131, CT22_323, CT23_223, CT24_332, CT25_242,
        CT26_424, CT27_141, CT28_414, CT29_213, CT30_312,
        CT31_1212, CT32_2121, CT33_1112, CT34_2111, CT35_1221,
        CT36_2211, CT37_3121, CT38_1321, CT39_2312, CT40_3212,
        CT41_Pattern5, CT42_Cycle3, CT43_Cycle4, CT44_55, CT45_66,
        CT46_343, CT47_434, CT48_252, CT49_525, CT50_Long,
        CT51_333, CT52_2222, CT53_11111, CT54_1232, CT55_2323,
        CT56_3232, CT57_1213, CT58_3123, CT59_2123, CT60_1323,
        CT61_2232, CT62_3223, CT63_1131, CT64_3113, CT65_2212,
        CT66_1223, CT67_3213, CT68_1312, CT69_2132, CT70_3132,
        CT71_DaoChieu, CT72_21112, CT73_12221, CT74_31113, CT75_13331,
        CT76_2223, CT77_3222, CT78_1122, CT79_2211, CT80_1133,
        CT81_3311, CT82_1231, CT83_3122, CT84_2233, CT85_3322,
        CT86_1123, CT87_3211, CT88_1322, CT89_2113, CT90_3112,
        CT91_1222, CT92_2221, CT93_3323, CT94_2332, CT95_3233,
        CT96_1113, CT97_3111, CT98_2311, CT99_1311, CT100_TongHop
    ];

    for (const formula of formulas) {
        const result = formula(arr);
        if (result) {
            results.push(result);
        }
    }

    // Nếu không có công thức nào -> dùng tần suất
    if (results.length === 0) {
        const ts = demTanSuat(arr);
        const max = Math.max(ts.B, ts.P, ts.T);
        let predict = 'B';
        let name = 'Tần suất B';
        if (ts.P === max) { predict = 'P'; name = 'Tần suất P'; }
        if (ts.T === max && ts.T > ts.B && ts.T > ts.P) { predict = 'T'; name = 'Tần suất T'; }
        
        return {
            Dự_đoán: predict === 'B' ? 'BANKER' : predict === 'P' ? 'PLAYER' : 'TIE',
            Tỉ_lệ: `${Math.round(max)}%`,
            Độ_tin_cậy: '55%',
            Loại_cầu: name,
            BANKER: `${Math.round(ts.B)}%`,
            PLAYER: `${Math.round(ts.P)}%`,
            TIE: `${Math.round(ts.T)}%`,
            Số_công_thức: '0 (dùng tần suất)',
            Top_10_cầu: 'Không có'
        };
    }

    // Tổng hợp điểm
    let scoreB = 0, scoreP = 0, scoreT = 0;
    let countB = 0, countP = 0, countT = 0;

    for (const r of results) {
        if (r.predict === 'B') { scoreB += r.conf; countB++; }
        else if (r.predict === 'P') { scoreP += r.conf; countP++; }
        else if (r.predict === 'T') { scoreT += r.conf; countT++; }
    }

    // Điểm trung bình
    let avgB = countB > 0 ? scoreB / countB : 30;
    let avgP = countP > 0 ? scoreP / countP : 30;
    let avgT = countT > 0 ? scoreT / countT : 8;

    // Chuẩn hóa
    const total = avgB + avgP + avgT;
    avgB = avgB / total * 100;
    avgP = avgP / total * 100;
    avgT = avgT / total * 100;

    // Confidence
    const baseConf = Math.min(50 + results.length * 0.8, 95);
    const confB = Math.min(baseConf + (avgB - 33) * 1.2, 95);
    const confP = Math.min(baseConf + (avgP - 33) * 1.2, 95);
    const confT = Math.min(baseConf + (avgT - 33) * 1.0, 85);

    // Chọn dự đoán
    const sides = [
        {name: 'BANKER', rate: Math.round(avgB), conf: Math.round(confB)},
        {name: 'PLAYER', rate: Math.round(avgP), conf: Math.round(confP)},
        {name: 'TIE', rate: Math.round(avgT), conf: Math.round(confT)}
    ];
    sides.sort((a,b) => b.conf - a.conf);
    const best = sides[0];
    const second = sides[1];

    // Lấy top 10 cầu
    results.sort((a,b) => b.conf - a.conf);
    const top10 = results.slice(0, 10).map((r, i) => `${i+1}. ${r.name} (${r.conf}%)`).join(' | ');

    return {
        Dự_đoán: best.name,
        Tỉ_lệ: `${best.rate}%`,
        Độ_tin_cậy: `${best.conf}%`,
        Loại_cầu: results[0]?.name || 'Không xác định',
        BANKER: `${Math.round(avgB)}% (${Math.round(confB)}%)`,
        PLAYER: `${Math.round(avgP)}% (${Math.round(confP)}%)`,
        TIE: `${Math.round(avgT)}% (${Math.round(confT)}%)`,
        Số_công_thức: `${results.length}/100`,
        Top_10_cầu: top10,
        Chênh_lệch: `${Math.round(best.conf - second.conf)}%`
    };
}

// ============================================================
// API
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

        const result = duDoanSieuVIP(cauGoc);

        res.json({
            phiên: sessionData[tableId],
            cầu_gốc: cauGoc,
            ...result,
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

            const result = duDoanSieuVIP(cauGoc);
            
            predictions[id] = {
                phiên: sessionData[id],
                Dự_đoán: result.Dự_đoán,
                Tỉ_lệ: result.Tỉ_lệ,
                Độ_tin_cậy: result.Độ_tin_cậy,
                Loại_cầu: result.Loại_cầu,
                BANKER: result.BANKER,
                PLAYER: result.PLAYER,
                TIE: result.TIE,
                Số_công_thức: result.Số_công_thức
            };
        }

        res.json({
            success: true,
            engine: 'VIP-100-CONGTHUC-SIEU-VIP',
            timestamp: new Date().toISOString(),
            author: '@tranhoang2286',
            tong_cong_thuc: 100,
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

app.get('/', (req, res) => {
    res.json({
        name: 'BACCARAT VIP - 100 CÔNG THỨC SIÊU VIP',
        version: '1.0.0',
        author: '@tranhoang2286',
        tong_cong_thuc: 100,
        danh_sach_cong_thuc: [
            'CT1-20: Cầu cơ bản (Macau, Vegas, London)',
            'CT21-40: Cầu biến thể (Singapore, Dubai, Tokyo)',
            'CT41-70: Cầu nâng cao (Seoul, Paris, Monaco)',
            'CT71-100: Cầu siêu VIP (Châu Á, Âu Mỹ, toàn cầu)'
        ],
        features: [
            '✅ 100 CÔNG THỨC NHẬN DIỆN CẦU',
            '✅ TỔNG HỢP TỪ CAO THỦ THẾ GIỚI',
            '✅ PHÂN TÍCH ĐA CHIỀU',
            '✅ KHÔNG RANDOM',
            '✅ TOP 10 CẦU TỐT NHẤT'
        ],
        endpoints: {
            'Dự đoán 1 bàn': '/api/predict/:tableId',
            'Dự đoán tất cả': '/api/predict/all',
            'Lấy dữ liệu bàn': '/api/baccarat/:tableId'
        }
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('══════════════════════════════════════════════');
    console.log('🃏 BACCARAT VIP - 100 CÔNG THỨC SIÊU VIP');
    console.log('══════════════════════════════════════════════');
    console.log(`🚀 http://localhost:${PORT}`);
    console.log('📌 100 CÔNG THỨC NHẬN DIỆN CẦU');
    console.log('  CT1-20: Cầu cơ bản');
    console.log('  CT21-40: Cầu biến thể');
    console.log('  CT41-70: Cầu nâng cao');
    console.log('  CT71-100: Cầu siêu VIP');
    console.log('  ✅ KHÔNG RANDOM');
    console.log(`👤 @tranhoang2286`);
    console.log('══════════════════════════════════════════════');
});
