def process_ball_event(match_state, event_type, runs_scored=0, extra_type=None, dismissal=None, fielder_id=None):
    inn_key = f"innings_{match_state['current_innings']}"
    inn = match_state["innings"][inn_key]
    
    striker_id = inn["striker_id"]
    bowler_id = inn["current_bowler_id"]
    
    is_legal_ball = True
    
    # Handle Extras Setup
    if event_type == "extra":
        if extra_type in ["WD", "NB"]:
            is_legal_ball = False
            inn["extras"][extra_type.lower()] += 1
            inn["extras"]["total"] += 1
            inn["total_runs"] += 1
            
            if runs_scored > 0:
                inn["total_runs"] += runs_scored
                inn["extras"]["total"] += runs_scored
                inn["bowlers"][bowler_id]["runs"] += (1 + runs_scored)
        else: # Byes or Leg Byes
            inn["extras"][extra_type.lower()] += runs_scored
            inn["extras"]["total"] += runs_scored
            inn["total_runs"] += runs_scored
            
    elif event_type == "run":
        inn["total_runs"] += runs_scored
        inn["batsmen"][striker_id]["runs"] += runs_scored
        inn["bowlers"][bowler_id]["runs"] += runs_scored
        if runs_scored == 4:
            inn["batsmen"][striker_id]["fours"] += 1
        elif runs_scored == 6:
            inn["batsmen"][striker_id]["sixes"] += 1
            
    if is_legal_ball:
        inn["total_balls"] += 1
        inn["batsmen"][striker_id]["balls"] += 1
        inn["bowlers"][bowler_id]["balls"] += 1
        
        # Format bowler overs safely
        b_balls = inn["bowlers"][bowler_id]["balls"]
        inn["bowlers"][bowler_id]["overs_bowled"] = round((b_balls // 6) + (b_balls % 6) / 10, 1)

    # Dismissal Processing
    if dismissal:
        inn["wickets"] += 1
        inn["batsmen"][striker_id]["out_status"] = dismissal
        inn["bowlers"][bowler_id]["wickets"] += 1
        
        if fielder_id:
            if fielder_id not in inn["fielding"]:
                inn["fielding"][fielder_id] = {"catches": 0, "stumpings": 0, "run_outs": 0}
            if dismissal == "Catch Out":
                inn["fielding"][fielder_id]["catches"] += 1
            elif dismissal == "Stumped":
                inn["fielding"][fielder_id]["stumpings"] += 1
            elif dismissal == "Run Out":
                inn["fielding"][fielder_id]["run_outs"] += 1
                
        inn["striker_id"] = None

    # Consolidated physical strike rotation check
    if runs_scored % 2 != 0 and not dismissal:
        inn["striker_id"], inn["non_striker_id"] = inn["non_striker_id"], inn["striker_id"]
        
    # Over End Check
    if is_legal_ball and (inn["total_balls"] % 6 == 0) and not dismissal:
        inn["striker_id"], inn["non_striker_id"] = inn["non_striker_id"], inn["striker_id"]
        
    return match_state