from flask import Flask, request, Response
import flask
from flask_sqlalchemy import SQLAlchemy
import os
from credentials_celery import *
from logging.config import dictConfig
from flask_sslify import SSLify
from flask_migrate import Migrate
from flask_bcrypt import Bcrypt
from flask_login import LoginManager
import sys
import logging
import telethon
from celery.schedules import crontab


logging.basicConfig(level=logging.DEBUG)


#setup logging
dictConfig({
    'version': 1,
    'formatters': {'default': {
        'format': '[%(asctime)s] %(levelname)s in %(module)s: %(message)s',
    }},
    'handlers': {'wsgi': {
        'class': 'logging.StreamHandler',
        'stream': 'ext://flask.logging.wsgi_errors_stream',
        'formatter': 'default'
    }},
    'root': {

        'handlers': ['wsgi']
    }
})

#statring...
global app
global db

app = Flask(__name__)

app.config['SECRET_KEY'] = 'tgKEYsecret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

app.config['CELERY_TIMEZONE'] = 'UTC'
app.config['CELERY_RESULT_BACKEND'] = 'amqp://guest:guest@localhost:5672//'

app.config['CELERYBEAT_SCHEDULE'] = {
    'test-celery': {
        'task': 'celery_hanlers.parse_subscribers',
        #'task': 'parse_subscribers',
        # Every minute
        'schedule': crontab(minute="*")
    }
}

db = SQLAlchemy(app)

migrate = Migrate(app, db)
bcrypt = Bcrypt(app)

login_manager = LoginManager(app)
login_manager.login_view = 'login'
login_manager.login_message_category = 'info'
