from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField, BooleanField, SelectField
from wtforms.validators import DataRequired, Length, Email, EqualTo, ValidationError
from flaskr.models import User, Channel, Category, Task, CategoryList, Offer


class RegistrationForm(FlaskForm):
    username = StringField('Username',
                           validators=[DataRequired(), Length(min=2, max=32)])
    password = PasswordField('Password', validators=[DataRequired()])
    confirm_password = PasswordField('Confirm Password',
                                     validators=[DataRequired(), EqualTo('password')])
    #status = SelectField('Status',
                        #choices=[('advertiser','advertiser'), ('affiliate','affiliate')])
    role = SelectField('Role',
                        choices=[('Advertiser','Advertiser'), ('Affiliate','Affiliate'), ('Moderator','Moderator'), ('Admin','Admin')])
    submit = SubmitField('Sign Up')

    def validate_username(self, username):
        user = User.query.filter_by(username=username.data).first()
        if user:
            raise ValidationError('That username is taken. Please choose a different one.')


class LoginForm(FlaskForm):
    username = StringField('Username',
                           validators=[DataRequired(), Length(min=2, max=32)])
    password = PasswordField('Password', validators=[DataRequired()])
    remember = BooleanField('Remember Me')
    submit = SubmitField('Login')


class ChangePassForm(FlaskForm):
    passwordOld = PasswordField('Old Password', validators=[DataRequired()])
    passwordNew = PasswordField('New Password', validators=[DataRequired()])
    confirm_passwordNew = PasswordField('Confirm New Password',
                                     validators=[DataRequired(), EqualTo('passwordNew')])
    submit = SubmitField('Change password')


class AddChannelForm(FlaskForm):
    tgUrl = StringField('Telegram url of the channel', validators=[DataRequired()])
    submit = SubmitField('Add channel')

    def validate_channel(self, tgUrl):
        channel = Channel.query.filter_by(tgUrl=tgUrl.data).first()
        if channel:
            raise ValidationError('That channel URL is added. Please choose a different one.')


class CreateOfferForm(FlaskForm):
    tgLink = StringField('Telegram url of the channel', validators=[DataRequired()])
    offerType = SelectField('Offer type',
                        choices=[('click','click'), ('subscribe','subscribe')])
    submit = SubmitField('Create offer')


class AddCategoryForm(FlaskForm):
    title = StringField('Title of the category', validators=[DataRequired()])
    submit = SubmitField('Add category')

    def validate_category(self, username):
        category = Category.query.filter_by(title=title.data).first()
        if category:
            raise ValidationError('That category is added. Please choose a different one.')