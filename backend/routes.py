from flask import Blueprint, render_template, request, jsonify, session, redirect, url_for
from backend.auth import verify_admin, login_required
from backend.utils import generate_match_code, calculate_run_rate, calculate_strike_rate, calculate_economy
from backend.match_logic import initialize_match_state
from backend.score_engine import process_ball_event

main = Blueprint('main', __name__)

# Firebase database global reference injection point
db_ref = None

def set_db(reference):
    global db_ref
    db_ref = reference

@main.route('/')
def index_page():
    return render_template('index.html')

@main.route('/login', methods=['GET', 'POST'])
def login_page():
    if request.method == 'POST':
        data = request.json or request.form
        username = data.get('username')
        password = data.get('password')
        if verify_admin(username, password):
            session['admin_logged_in'] = True
            session['username'] = username
            return jsonify({"status": "success", "redirect": url_for('main.home_page')})
        return jsonify({"status": "error", "message": "Invalid Admin Credentials"}), 401
    return render_template('login.html')

@main.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('main.index_page'))

@main.route('/home')
@login_required
def home_page():
    return render_template('home.html')

@main.route('/player')
@login_required
def player_page():
    return render_template('player.html')

@main.route('/team')
@login_required
def team_page():
    return render_template('team.html')

@main.route('/match')
@login_required
def match_page():
    return render_template('match.html')

@main.route('/scorecard/<match_code>')
def scorecard_page(match_code):
    admin_view = session.get('admin_logged_in', False)
    return render_template('scorecard.html', match_code=match_code, admin_view=admin_view)

@main.route('/detailed-score/<match_code>')
def detailed_score_page(match_code):
    return render_template('detailed_score.html', match_code=match_code)

# API LAYER ENDPOINTS
@main.route('/api/players', methods=['GET', 'POST'])
def api_players():
    players_ref = db_ref.child('players')
    if request.method == 'POST':
        if not session.get('admin_logged_in'): return jsonify({"error": "Unauthorized"}), 401
        player_data = request.json
        # Constraint limit ~35 players
        existing = players_ref.get() or {}
        if len(existing) >= 35:
            return jsonify({"status": "error", "message": "Max player limit (35) reached."}), 400
        new_ref = players_ref.push()
        player_data['id'] = new_ref.key
        new_ref.set(player_data)
        return jsonify({"status": "success", "player": player_data})
    return jsonify(players_ref.get() or {})

@main.route('/api/teams', methods=['GET', 'POST'])
def api_teams():
    teams_ref = db_ref.child('teams')
    if request.method == 'POST':
        if not session.get('admin_logged_in'): return jsonify({"error": "Unauthorized"}), 401
        team_data = request.json
        new_ref = teams_ref.push()
        team_data['id'] = new_ref.key
        new_ref.set(team_data)
        return jsonify({"status": "success", "team": team_data})
    return jsonify(teams_ref.get() or {})

@main.route('/api/match/create', methods=['POST'])
@login_required
def api_create_match():
    data = request.json
    match_code = generate_match_code()
    match_id = db_ref.child('matches').push().key
    
    data['match_id'] = match_id
    initial_state = initialize_match_state(data)
    
    db_ref.child('matches').child(match_id).set(initial_state)
    db_ref.child('match_codes').child(match_code).set(match_id)
    
    return jsonify({"status": "success", "match_code": match_code})

@main.route('/api/match/live/<match_code>', methods=['GET'])
def api_live_match(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    if not match_id:
        return jsonify({"status": "error", "message": "Match code invalid"}), 404
    state = db_ref.child('matches').child(match_id).get()
    return jsonify(state)

@main.route('/api/match/update/<match_code>', methods=['POST'])
@login_required
def api_update_score(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    state = db_ref.child('matches').child(match_id).get()
    
    post_data = request.json # Contains event_type, runs_scored, extra_type, dismissal, fielder_id
    updated_state = process_ball_event(
        state, 
        event_type=post_data.get('event_type'),
        runs_scored=int(post_data.get('runs_scored', 0)),
        extra_type=post_data.get('extra_type'),
        dismissal=post_data.get('dismissal'),
        fielder_id=post_data.get('fielder_id')
    )
    
    db_ref.child('matches').child(match_id).set(updated_state)
    return jsonify({"status": "success", "state": updated_state})

@main.route('/api/match/next-innings/<match_code>', methods=['POST'])
@login_required
def api_next_innings(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    state = db_ref.child('matches').child(match_id).get()
    data = request.json
    
    state['current_innings'] = 2
    state['status'] = 'live'
    state['innings']['innings_2'] = {
        "batting_team": state['innings']['innings_1']['bowling_team'],
        "bowling_team": state['innings']['innings_1']['batting_team'],
        "total_runs": 0,
        "wickets": 0,
        "total_balls": 0,
        "extras": {"wd": 0, "nb": 0, "b": 0, "lb": 0, "total": 0},
        "batsmen": {
            data["striker_id"]: {"id": data["striker_id"], "name": data["striker_name"], "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"},
            data["non_striker_id"]: {"id": data["non_striker_id"], "name": data["non_striker_name"], "runs": 0, "balls": 0, "fours": 0, "sixes": 0, "out_status": "not out"}
        },
        "bowlers": {
            data["bowler_id"]: {"id": data["bowler_id"], "name": data["bowler_name"], "overs_bowled": 0.0, "balls": 0, "runs": 0, "wickets": 0, "maidens": 0}
        },
        "fielding": {},
        "striker_id": data["striker_id"],
        "non_striker_id": data["non_striker_id"],
        "current_bowler_id": data["bowler_id"],
        "wicketkeeper_id": data["wicketkeeper_id"]
    }
    
    db_ref.child('matches').child(match_id).set(state)
    return jsonify({"status": "success"})

@main.route('/api/match/complete/<match_code>', methods=['POST'])
@login_required
def api_complete_match(match_code):
    match_id = db_ref.child('match_codes').child(match_code).get()
    state = db_ref.child('matches').child(match_id).get()
    
    r1 = state['innings']['innings_1']['total_runs']
    r2 = state['innings']['innings_2']['total_runs']
    
    if r1 > r2:
        winner = state['innings']['innings_1']['batting_team']
    elif r2 > r1:
        winner = state['innings']['innings_2']['batting_team']
    else:
        winner = "Match Tied"
        
    state['status'] = 'completed'
    state['winner'] = winner
    
    db_ref.child('matches').child(match_id).set(state)
    return jsonify({"status": "success", "winner": winner})