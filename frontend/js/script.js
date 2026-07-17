function viewMatchSpectator() {
    const code = document.getElementById('matchCodeInput').value.trim().toUpperCase();
    if(code) window.location.href = `/scorecard/${code}`;
}

function executeAdminLogin() {
    const user = document.getElementById('adminUser').value;
    const pass = document.getElementById('adminPassword').value;
    
    fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
    })
    .then(res => {
        if(res.ok) return res.json();
        throw new Error("Validation Failed");
    })
    .then(data => window.location.href = data.redirect)
    .catch(err => alert("Unauthorized Admin Signature. Access Denied."));
}

function loadPlayerRoster() {
    fetch('/api/players')
    .then(res => res.json())
    .then(players => {
        const container = document.getElementById('playerListContainer');
        const action = document.getElementById('actionContainer');
        const count = Object.keys(players).length;
        
        container.innerHTML = '';
        if(count === 0) {
            container.innerHTML = `<div style="text-align:center; padding:40px; border:2px dashed black;">NO PROFILES RECORDED</div>`;
            action.innerHTML = `<button style="width:100%;" onclick="togglePlayerModal(true)">+ ADD INITIAL PLAYER</button>`;
        } else {
            Object.values(players).forEach(p => {
                container.innerHTML += `
                    <div class="bento-card full-width" style="padding:10px; margin-bottom:8px; flex-direction:row;">
                        <div><strong>${p.name}</strong> <br><small style="color:var(--muted-gray);">${p.role} | ${p.hand}</small></div>
                    </div>`;
            });
            if(count < 35) {
                action.innerHTML = `<button style="position:fixed; bottom:20px; right:20px; border-radius:50%; width:55px; height:55px; box-shadow:3px 3px 0 black; font-size:1.5rem; padding:0;" onclick="togglePlayerModal(true)">+</button>`;
            }
        }
    });
}

function togglePlayerModal(show) {
    document.getElementById('playerModal').style.display = show ? 'flex' : 'none';
}

function savePlayerProfile() {
    const pData = {
        name: document.getElementById('pName').value.trim(),
        role: document.getElementById('pRole').value,
        hand: document.getElementById('pHand').value
    };
    if(!pData.name) return alert("Identify Name Field");

    fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pData)
    }).then(() => {
        togglePlayerModal(false);
        loadPlayerRoster();
    });
}

let rosterMemory = [];
let selectedTeamAPlayers = [];
let selectedTeamBPlayers = [];

function setupTeamConfigScreen() {
    fetch('/api/players')
    .then(res => res.json())
    .then(players => {
        rosterMemory = Object.values(players).sort((a,b) => a.name.localeCompare(b.name));
        renderTeamPools();
    });
}

function renderTeamPools() {
    const pool = document.getElementById('availableTeamPool');
    pool.innerHTML = '';
    rosterMemory.forEach(p => {
        if(!selectedTeamAPlayers.includes(p.id) && !selectedTeamBPlayers.includes(p.id)) {
            pool.innerHTML += `<div style="padding:6px; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;">
                <span>${p.name} (${p.role})</span>
                <div>
                    <button onclick="movePlayerToTeam('${p.id}', 'A')" style="padding:2px 6px; font-size:0.7rem; box-shadow:none;">+A</button>
                    <button onclick="movePlayerToTeam('${p.id}', 'B')" style="padding:2px 6px; font-size:0.7rem; box-shadow:none; background:var(--accent-red);">+B</button>
                </div>
            </div>`;
        }
    });
    syncPanelList('A', selectedTeamAPlayers);
    syncPanelList('B', selectedTeamBPlayers);
}

function syncPanelList(panel, targetArray) {
    const listDiv = document.getElementById(`team${panel}Players`);
    const capSel = document.getElementById(`cap${panel}`);
    const activeCap = capSel.value;
    
    listDiv.innerHTML = '';
    capSel.innerHTML = `<option value="">Select Capt</option>`;
    
    targetArray.forEach(id => {
        const p = rosterMemory.find(x => x.id === id);
        listDiv.innerHTML += `<div style="display:flex; justify-content:space-between; margin-bottom:3px;">
            <span>${p.name}</span> <span style="color:red; cursor:pointer;" onclick="removePlayerFromTeam('${id}', '${panel}')">x</span>
        </div>`;
        capSel.innerHTML += `<option value="${id}">${p.name}</option>`;
    });
    capSel.value = activeCap;
}

function movePlayerToTeam(id, panel) {
    if(panel === 'A') selectedTeamAPlayers.push(id);
    else selectedTeamBPlayers.push(id);
    renderTeamPools();
}

function removePlayerFromTeam(id, panel) {
    if(panel === 'A') selectedTeamAPlayers = selectedTeamAPlayers.filter(x => x !== id);
    else selectedTeamBPlayers = selectedTeamBPlayers.filter(x => x !== id);
    renderTeamPools();
}

function filterAvailablePlayers() {
    const query = document.getElementById('searchBar').value.toLowerCase();
    const rows = document.getElementById('availableTeamPool').children;
    Array.from(rows).forEach(row => {
        const text = row.querySelector('span').innerText.toLowerCase();
        row.style.display = text.includes(query) ? 'flex' : 'none';
    });
}

function commitTeamConfiguration() {
    const nameA = document.getElementById('teamAName').value;
    const nameB = document.getElementById('teamBName').value;
    const cA = document.getElementById('capA').value;
    const cB = document.getElementById('capB').value;
    
    if(!cA || !cB) return alert("Select Captain for both teams first!");
    
    const teamAData = { name: nameA, captain: cA, players: selectedTeamAPlayers };
    const teamBData = { name: nameB, captain: cB, players: selectedTeamBPlayers };
    
    Promise.all([
        fetch('/api/teams', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(teamAData) }),
        fetch('/api/teams', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(teamBData) })
    ]).then(() => {
        alert("Teams successfully registered configuration blueprints.");
        window.location.href = '/home';
    });
}

let globalTeams = {};
function initMatchSetupFields() {
    fetch('/api/teams')
    .then(res => res.json())
    .then(teams => {
        globalTeams = teams;
        const selA = document.getElementById('mTeamA');
        const selB = document.getElementById('mTeamB');
        
        if (Object.keys(teams).length === 0) {
            alert("No teams found. Please create teams before starting a match.");
            window.location.href = '/home';
            return;
        }
        
        Object.entries(teams).forEach(([key, t]) => {
            selA.innerHTML += `<option value="${key}">${t.name}</option>`;
            selB.innerHTML += `<option value="${key}">${t.name}</option>`;
        });
        syncMatchPlayers();
    });
}

function syncMatchPlayers() {
    fetch('/api/players').then(res => res.json()).then(players => {
        const valA = document.getElementById('mTeamA').value;
        const valB = document.getElementById('mTeamB').value;
        
        const tA = globalTeams[valA];
        const tB = globalTeams[valB];
        
        const striker = document.getElementById('mStriker');
        const nonStriker = document.getElementById('mNonStriker');
        const bowler = document.getElementById('mBowler');
        const keeper = document.getElementById('mKeeper');
        
        striker.innerHTML = ''; nonStriker.innerHTML = ''; bowler.innerHTML = ''; keeper.innerHTML = '';
        
        if(tA && tA.players) {
            tA.players.forEach(pid => {
                const p = players[pid];
                if(p) {
                    striker.innerHTML += `<option value="${pid}">${p.name}</option>`;
                    nonStriker.innerHTML += `<option value="${pid}">${p.name}</option>`;
                    keeper.innerHTML += `<option value="${pid}">${p.name}</option>`;
                }
            });
        }
        if(tB && tB.players) {
            tB.players.forEach(pid => {
                const p = players[pid];
                if(p) bowler.innerHTML += `<option value="${pid}">${p.name}</option>`;
            });
        }
    });
}

function launchMatchEngine() {
    const tAKey = document.getElementById('mTeamA').value;
    const tBKey = document.getElementById('mTeamB').value;
    
    const payload = {
        team_a_name: globalTeams[tAKey].name,
        team_b_name: globalTeams[tBKey].name,
        max_overs: document.getElementById('mOvers').value,
        toss_winner: document.getElementById('mTossWinner').value === 'A' ? globalTeams[tAKey].name : globalTeams[tBKey].name,
        decision: document.getElementById('mDecision').value,
        batting_team: document.getElementById('mDecision').value === 'Bat' ? (document.getElementById('mTossWinner').value === 'A' ? globalTeams[tAKey].name : globalTeams[tBKey].name) : (document.getElementById('mTossWinner').value === 'A' ? globalTeams[tBKey].name : globalTeams[tAKey].name),
        bowling_team: document.getElementById('mDecision').value === 'Bowl' ? (document.getElementById('mTossWinner').value === 'A' ? globalTeams[tAKey].name : globalTeams[tBKey].name) : (document.getElementById('mTossWinner').value === 'A' ? globalTeams[tBKey].name : globalTeams[tAKey].name),
        striker_id: document.getElementById('mStriker').value,
        striker_name: document.getElementById('mStriker').options[document.getElementById('mStriker').selectedIndex].text,
        non_striker_id: document.getElementById('mNonStriker').value,
        non_striker_name: document.getElementById('mNonStriker').options[document.getElementById('mNonStriker').selectedIndex].text,
        bowler_id: document.getElementById('mBowler').value,
        bowler_name: document.getElementById('mBowler').options[document.getElementById('mBowler').selectedIndex].text,
        wicketkeeper_id: document.getElementById('mKeeper').value
    };
    
    fetch('/api/match/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => window.location.href = `/scorecard/${data.match_code}`);
}

let liveStateMemory = null;

function startLiveScoreSynchronizationLoop() {
    fetchLiveScoreboardData();
    setInterval(fetchLiveScoreboardData, 4000);
}

function fetchLiveScoreboardData() {
    fetch(`/api/match/live/${window.matchCode}`)
    .then(res => res.json())
    .then(state => {
        liveStateMemory = state;
        updateLiveScoreboardUI(state);
    });
}

function updateLiveScoreboardUI(state) {
    const inn = state.innings[`innings_${state.current_innings}`];
    
    document.getElementById('liveBattingTeam').innerText = inn.batting_team;
    document.getElementById('liveScoreDisplay').innerText = `${inn.total_runs}/${inn.wickets}`;
    document.getElementById('liveOversDisplay').innerText = Math.floor(inn.total_balls / 6) + "." + (inn.total_balls % 6);
    document.getElementById('maxOversDisplay').innerText = state.max_overs;
    
    if(inn.striker_id && inn.batsmen[inn.striker_id]) {
        const s = inn.batsmen[inn.striker_id];
        document.getElementById('rowStriker').innerHTML = `<span>* ${s.name}</span> <span>${s.runs}(${s.balls})</span>`;
    } else {
        document.getElementById('rowStriker').innerHTML = `<span style="color:var(--accent-red);">[Vacant Crease Strike]</span> <span>-</span>`;
        if(window.isAdmin && state.status === 'live') promptNextPlayerReplacement('striker');
    }

    if(inn.non_striker_id && inn.batsmen[inn.non_striker_id]) {
        const ns = inn.batsmen[inn.non_striker_id];
        document.getElementById('rowNonStriker').innerHTML = `<span>${ns.name}</span> <span>${ns.runs}(${ns.balls})</span>`;
    } else {
        document.getElementById('rowNonStriker').innerHTML = `<span style="color:var(--accent-red);">[Vacant Crease Non-Strike]</span> <span>-</span>`;
        if(window.isAdmin && state.status === 'live') promptNextPlayerReplacement('non_striker');
    }

    if(inn.current_bowler_id && inn.bowlers[inn.current_bowler_id]) {
        const b = inn.bowlers[inn.current_bowler_id];
        document.getElementById('rowBowler').innerHTML = `<span>${b.name}</span> <span>${b.overs_bowled}-${b.maidens}-${b.runs}-${b.wickets}</span>`;
    }

    const crr = (inn.total_runs / (inn.total_balls / 6 || 1)).toFixed(2);
    document.getElementById('crrVal').innerText = crr;
    
    if(state.current_innings === 2) {
        const target = state.innings.innings_1.total_runs + 1;
        const runsNeeded = target - inn.total_runs;
        const totalMaxBalls = state.max_overs * 6;
        const ballsRemaining = totalMaxBalls - inn.total_balls;
        const rrr = (runsNeeded / (ballsRemaining / 6 || 1)).toFixed(2);
        document.getElementById('rrrVal').innerText = `${rrr} (Need ${runsNeeded} off ${ballsRemaining} bls)`;
        
        if(inn.total_runs >= target && state.status === 'live' && window.isAdmin) {
            triggerMatchCompletionPopup();
        } else if((inn.wickets >= 10 || ballsRemaining <= 0) && state.status === 'live' && window.isAdmin) {
            triggerMatchCompletionPopup();
        }
    } else {
        const totalMaxBalls = state.max_overs * 6;
        if((inn.total_balls >= totalMaxBalls || inn.wickets >= 10) && state.status === 'live' && window.isAdmin) {
            triggerInningsBreakPopup();
        }
    }

    if(window.isAdmin && inn.total_balls > 0 && inn.total_balls % 6 === 0 && state.status === 'live') {
        const expectedOvers = inn.total_balls / 6;
        if(inn.bowlers[inn.current_bowler_id] && inn.bowlers[inn.current_bowler_id].overs_bowled == expectedOvers) {
             promptNextBowlerAssignment();
        }
    }
}

function submitBallRecord(type, runs, extraType=null, dismissal=null, fielderId=null) {
    const payload = { event_type: type, runs_scored: runs, extra_type: extraType, dismissal: dismissal, fielder_id: fielderId };
    fetch(`/api/match/update/${window.matchCode}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
    }).then(res => res.json()).then(data => updateLiveScoreboardUI(data.state));
}

function triggerExtraPlusPopup() { document.getElementById('extraPlusModal').style.display = 'flex'; }
function commitExtraPlusAdjustment() {
    const type = document.getElementById('extType').value;
    const runs = document.getElementById('extRuns').value;
    document.getElementById('extraPlusModal').style.display = 'none';
    submitBallRecord('extra', runs, type);
}

function triggerWicketDismissal(type) {
    if(confirm(`Confirm operational dismissal: ${type}?`)) {
        submitBallRecord('wicket', 0, null, type);
    }
}

function triggerRunOutModal() {
    fetch('/api/players').then(res => res.json()).then(players => {
        const sel = document.getElementById('roFielder');
        sel.innerHTML = '';
        Object.values(players).forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
        document.getElementById('runOutModal').style.display = 'flex';
    });
}
function commitRunOutDismissal() {
    const fId = document.getElementById('roFielder').value;
    document.getElementById('runOutModal').style.display = 'none';
    submitBallRecord('wicket', 0, null, 'Run Out', fId);
}

let trackingReplacementKey = '';
function promptNextPlayerReplacement(keyPosition) {
    trackingReplacementKey = keyPosition;
    fetch('/api/players').then(res => res.json()).then(players => {
        const sel = document.getElementById('nextBatsmanSelect');
        sel.innerHTML = '';
        const inn = liveStateMemory.innings[`innings_${liveStateMemory.current_innings}`];
        Object.values(players).forEach(p => {
            if(!inn.batsmen[p.id] || inn.batsmen[p.id].out_status === 'not out') {
                 sel.innerHTML += `<option value="${p.id}">${p.name}</option>`;
            }
        });
        document.getElementById('newBatsmanModal').style.display = 'flex';
    });
}
function commitNewBatsman() {
    const sel = document.getElementById('nextBatsmanSelect');
    const pid = sel.value;
    const name = sel.options[sel.selectedIndex].text;
    document.getElementById('newBatsmanModal').style.display = 'none';
    
    const innKey = `innings_${liveStateMemory.current_innings}`;
    liveStateMemory.innings[innKey][trackingReplacementKey === 'striker' ? 'striker_id' : 'non_striker_id'] = pid;
    if (!liveStateMemory.innings[innKey].batsmen[pid]) {
        liveStateMemory.innings[innKey].batsmen[pid] = { id: pid, name: name, runs: 0, balls: 0, fours: 0, sixes: 0, out_status: "not out" };
    }
    
    fetch(`/api/match/update/${window.matchCode}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({event_type: 'sync', runs_scored: 0})
    });
}

function promptNextBowlerAssignment() {
    fetch('/api/players').then(res => res.json()).then(players => {
        const sel = document.getElementById('nextBowlerSelect');
        sel.innerHTML = '';
        Object.values(players).forEach(p => { sel.innerHTML += `<option value="${p.id}">${p.name}</option>`; });
        document.getElementById('newBowlerModal').style.display = 'flex';
    });
}
function commitNewBowler() {
    const sel = document.getElementById('nextBowlerSelect');
    const pid = sel.value;
    const name = sel.options[sel.selectedIndex].text;
    document.getElementById('newBowlerModal').style.display = 'none';
    
    const innKey = `innings_${liveStateMemory.current_innings}`;
    liveStateMemory.innings[innKey].current_bowler_id = pid;
    if(!liveStateMemory.innings[innKey].bowlers[pid]) {
        liveStateMemory.innings[innKey].bowlers[pid] = { id: pid, name: name, overs_bowled: 0.0, balls: 0, runs: 0, wickets: 0, maidens: 0 };
    }
    
    fetch(`/api/match/update/${window.matchCode}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({event_type: 'sync', runs_scored: 0})
    });
}

function triggerInningsBreakPopup() {
    const inn = liveStateMemory.innings.innings_1;
    document.getElementById('innSumScore').innerText = `${inn.total_runs}/${inn.wickets}`;
    document.getElementById('innSumTopPerformers').innerHTML = `
        <strong>Top Performance Logs:</strong><br>
        1st Inn Complete. Target set to: ${inn.total_runs + 1} runs.
    `;
    const btn = document.getElementById('innSumActionBtn');
    btn.innerText = "START SECOND INNINGS";
    btn.onclick = launchSecondInningsCreaseSetup;
    document.getElementById('inningsSummaryModal').style.display = 'flex';
}

function launchSecondInningsCreaseSetup() {
    document.getElementById('inningsSummaryModal').style.display = 'none';
    fetch('/api/players').then(res => res.json()).then(players => {
         const roster = Object.values(players);
         if(roster.length < 3) return alert("Ensure at least 3 players exist to configure basic crease slots.");
         
         fetch(`/api/match/next-innings/${window.matchCode}`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({
                  striker_id: roster[0].id, 
                  striker_name: roster[0].name,
                  non_striker_id: roster[1].id,
                  non_striker_name: roster[1].name,
                  bowler_id: roster[2].id,
                  bowler_name: roster[2].name,
                  wicketkeeper_id: roster[2].id
              })
         }).then(() => location.reload());
    });
}

function triggerMatchCompletionPopup() {
    fetch(`/api/match/complete/${window.matchCode}`, { method: 'POST', headers: {'Content-Type':'application/json'} })
    .then(res => res.json())
    .then(data => {
        document.getElementById('innSumScore').innerText = "MATCH COMPLETED";
        document.getElementById('innSumTopPerformers').innerHTML = `<strong>WINNER: ${data.winner}</strong>`;
        const btn = document.getElementById('innSumActionBtn');
        btn.innerText = "VIEW DETAILED SCORECARD";
        btn.onclick = () => window.location.href = `/detailed-score/${window.matchCode}`;
        document.getElementById('inningsSummaryModal').style.display = 'flex';
    });
}

function renderDetailedStatisticsView(code) {
    fetch(`/api/match/live/${code}`)
    .then(res => res.json())
    .then(state => {
        const area = document.getElementById('detailedOutputArea');
        area.innerHTML = '';
        
        if (state.winner) {
            const banner = document.getElementById('matchWinnerBanner');
            banner.innerText = `RESULT: ${state.winner.toUpperCase()}`;
            banner.style.display = 'block';
        }

        ["innings_1", "innings_2"].forEach(innKey => {
            const inn = state.innings[innKey];
            if(!inn) return;
            
            let html = `<div class="bento-card full-width" style="margin-bottom:15px; padding:12px;">
                <h3 style="border-bottom:1px solid black; padding-bottom:4px;">${inn.batting_team.toUpperCase()} (BATTING)</h3>
                <table style="width:100%; font-size:0.75rem; text-align:left; margin-top:5px; border-collapse:collapse;">
                    <tr style="border-bottom:1px solid #1A1A1A;"><th>Batsman</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>`;
            
            Object.values(inn.batsmen).forEach(b => {
                const sr = (b.balls > 0) ? ((b.runs/b.balls)*100).toFixed(1) : "0.0";
                html += `<tr style="border-bottom:0.5px solid #ddd;">
                    <td><strong>${b.name}</strong><br><small style="color:var(--accent-red);">${b.out_status}</small></td>
                    <td>${b.runs}</td><td>${b.balls}</td><td>${b.fours}</td><td>${b.sixes}</td><td>${sr}</td>
                </tr>`;
            });
            html += `</table>`;

            html += `<h3 style="border-bottom:1px solid black; padding-bottom:4px; margin-top:15px;">${inn.bowling_team.toUpperCase()} (BOWLING)</h3>
                <table style="width:100%; font-size:0.75rem; text-align:left; margin-top:5px; border-collapse:collapse;">
                    <tr style="border-bottom:1px solid #1A1A1A;"><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>ECON</th></tr>`;
            
            Object.values(inn.bowlers).forEach(b => {
                const totalOvers = Math.floor(b.balls / 6) + (b.balls % 6) / 10;
                const econ = (b.balls > 0) ? (b.runs / (b.balls / 6)).toFixed(2) : "0.00";
                html += `<tr style="border-bottom:0.5px solid #ddd;">
                    <td><strong>${b.name}</strong></td>
                    <td>${b.overs_bowled}</td><td>${b.maidens}</td><td>${b.runs}</td><td>${b.wickets}</td><td>${econ}</td>
                </tr>`;
            });
            html += `</table>`;

            if(inn.fielding && Object.keys(inn.fielding).length > 0) {
                html += `<h3 style="border-bottom:1px solid black; padding-bottom:4px; margin-top:15px;">FIELDING LOGS</h3>
                    <table style="width:100%; font-size:0.75rem; text-align:left; margin-top:5px; border-collapse:collapse;">
                        <tr style="border-bottom:1px solid #1A1A1A;"><th>Fielder</th><th>Catches</th><th>Stumpings</th><th>Run Outs</th></tr>`;
                Object.entries(inn.fielding).forEach(([fId, f]) => {
                    html += `<tr style="border-bottom:0.5px solid #ddd;">
                        <td><strong>Fielder Profile</strong></td><td>${f.catches}</td><td>${f.stumpings}</td><td>${f.run_outs}</td>
                    </tr>`;
                });
                html += `</table>`;
            }
            
            html += `</div>`;
            area.innerHTML += html;
        });
    });
}