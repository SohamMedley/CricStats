from functools import wraps
from flask import session, jsonify, request, redirect, url_for

ADMIN_USERS = {
    "Admin1": "Delta247",
    "Admin2": "Gamma247"
}

def verify_admin(username, password):
    return ADMIN_USERS.get(username) == password

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('admin_logged_in'):
            if request.is_json or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
                return jsonify({"status": "error", "message": "Unauthorized access"}), 401
            return redirect(url_for('login_page'))
        return f(*args, **kwargs)
    return decorated_function