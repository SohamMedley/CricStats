from flask import Flask
from backend.config import Config
from backend.firebase_config import init_firebase
from backend.routes import main, set_db

def create_app():
    # Added static_url_path explicitly so Flask maps '/frontend' properly to your assets
    app = Flask(__name__, 
                template_folder='../frontend/templates', 
                static_folder='../frontend',
                static_url_path='/frontend')
    app.config.from_object(Config)
    
    # Initialize DB Reference connection
    db_reference = init_firebase()
    set_db(db_reference)
    
    app.register_blueprint(main)
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000, debug=True)