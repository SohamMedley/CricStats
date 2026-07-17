import firebase_admin
from firebase_admin import credentials, db
from backend.config import Config

def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(Config.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred, {
            'databaseURL': Config.FIREBASE_DATABASE_URL
        })
    return db.reference()