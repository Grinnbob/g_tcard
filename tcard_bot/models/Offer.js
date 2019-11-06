'use strict';
const Markup = require('telegraf/markup')
const extra = require('telegraf/extra')

const logger = require('../helpers/logger')

const {i18n} = require('../middlewares/i18n')

const {OFFER_TYPE, OFFER_STATUS, OFFER_CODES} = require("../helpers/constants");
const {BOT_URL_PREFIX, APPLY_BUTTON_PREFIX} = require("../helpers/constants");

/*
The core difference is the type of an offer:
0 - finished when the number of users are ready
1 - finished when the total amount are collected (f.e. here you can buy by slots)

data - we use this field to store fields of an offer. Different views know how to show it.
*/

let db = null
module.exports = function(sequelize, DataTypes) {
	var Offer = sequelize.define('Offer', {
		id: {
			type: DataTypes.INTEGER,
			allowNull: false,
			primaryKey: true,
			autoIncrement: true
		},
		status : {
			type: DataTypes.INTEGER,
			allowNull: true
        },
        type : {
			type: DataTypes.INTEGER,
			allowNull: true
        },
        total : {
            type: DataTypes.INTEGER,
			allowNull: false 
        },
        current : {
            type: DataTypes.INTEGER,
			allowNull: true
		},
		start_amount : {
            type: DataTypes.INTEGER,
			allowNull: true 
		},
		url : {
            type: DataTypes.STRING,
			allowNull: true,
		},
		due_date : {
			type: DataTypes.DATE,
			allowNull: true
		},
		published_to : {
            type: DataTypes.TEXT,
			allowNull: true,
		},
        data : {
            type: DataTypes.TEXT,
			allowNull: true,        
        }
	}, {
		timestamps: true,
		schema: 'public'
	});
	
	Offer.associate = function(models) {
		Offer.belongsTo(models.User);
		Offer.hasMany(models.OfferParticipantsQueue);

		db = models;
	};

	Offer.get_offer = async function(offer_id){
		var offer = await db.Offer.findOne({
			where : {
				id : offer_id
			}
		})
		return offer;
	}

	Offer.offers_for = async function(user_tg_id){
		var current_user = await db.User.get_user(user_tg_id);
		var data = {};

		if (!current_user){
			return data;
		}

		var offers = await db.Offer.findAll({
			attributes: ['id'], 
			raw: true,
			where : {
				UserId : current_user.id
			}
		})

		var arr = []
        offers.forEach(element => {
            arr.push(element.id)
        });
		if(arr.length > 0){
			data['offer_list'] = arr;
		}
		return data;
	}

	Offer.new_offer = async function(user_tg_id, data){
		let offer;

		try {
			var current_user = await db.User.get_user(user_tg_id)
			if (!current_user){
				throw("There is no such user")
			}

			var offer_type = OFFER_TYPE.num
			if (data['offerType'] == 'enter_sum_4'){
				offer_type = OFFER_TYPE.sum
			}


			offer = await Offer.create(
				{
					type : offer_type,
					status: OFFER_STATUS.new,
					current: 0,
					total : data['amount'],
					start_amount : data['startAmount'],
					due_date : data['dueDate'],
					UserId : current_user.id,
					data : JSON.stringify(data)
				}
			)
		}catch(error){
			logger.error("Offer.new_offer: Can't create offer %s", error)
			return -1;
		}

		return offer;
	}

	Offer.prototype.get_data = async function(){
        return await JSON.parse(this.data);
	}
	
	Offer.prototype.activate = async function(){
		this.status = OFFER_STATUS.active;
		this.save()
    }

	Offer.prototype.get_message = async function(){
		var data = await this.get_data()
		data['current'] = this.current + this.start_amount;

		var message = await i18n.t(i18n.current_locale, 'offer_num_post_template', data)
		if (this.type == OFFER_TYPE.sum){
			message = await i18n.t(i18n.current_locale, 'offer_sum_post_template', data)
		}

		return message;
	}


	Offer.prototype.edit_offer = async function(data){
		if (this.status == OFFER_STATUS['finished']){
			return;
		}

		this.total = data['amount'];
		this.start_amount = data['startAmount'];
		this.due_date = data['dueDate'];
		this.data = JSON.stringify(data)

		this.save()
	}

	Offer.prototype.set_url = async function(bot_name){
		var url = BOT_URL_PREFIX + bot_name + '?start=' + APPLY_BUTTON_PREFIX + this.id;

		this.url = url
		this.save()

		return url;
	}

	Offer.prototype.get_url = async function(){
		return this.url;
	}

	Offer.prototype.is_sum = function(){
		if (this.type == OFFER_TYPE.sum){
			return true;
		} 

		return false;
	}

	Offer.prototype.is_finished = function(){
		if (this.status == OFFER_STATUS.paused || this.status == OFFER_STATUS.finished){
			return true;
		}

		return false;
	}

	Offer.prototype.get_participant = async function(tgId){
		var participant = await db.OfferParticipantsQueue.findOne({
			where : {
				tgId : tgId,
				OfferId: this.id
			}
		})

		return participant;
	}

	Offer.prototype.add_participant = async function(tgId){
		var participant = null;

		try{
			var exist = await db.OfferParticipantsQueue.findOne({
					where : {
						tgId : tgId,
						OfferId: this.id
					}
				})
			if (exist){
				return OFFER_CODES.exist;
			}

			participant = await db.OfferParticipantsQueue.create(
				{
					tgId : tgId,
					OfferId: this.id
				}
			)
		}catch(error){
			logger.error("FAILED: Offer.add_participant error: %s", error)
			return OFFER_CODES.unknown_error
		}

		return participant;
	}

	Offer.prototype.get_hello_message = async function(){
		var data = JSON.parse(this.data)

		var hello_message = data['messageHello']

		var formated_message = await i18n.t(i18n.current_locale, 'apply_offer_hello_message', {hello : hello_message})

		return formated_message;
	}

	Offer.prototype.get_slots_array = async function(){
		var data = JSON.parse(this.data)
		var slots = data['slots']

		return slots.split(',')
	}

	Offer.prototype.get_slot_message = async function(){
		var data = JSON.parse(this.data)

		var slot_message = data['slot_message']

		var formated_message = await i18n.t(i18n.current_locale, 'apply_offer_slot_message', {slot_message : slot_message})

		var variants = await this.get_slots_array()
	
		var buttons = []
		var i = 0;
		variants.forEach(function(item){
			var handle = 'value-' + i;
			i = i +1;
			buttons.push(Markup.callbackButton(item, handle));
		});

		var keyboard = Markup.inlineKeyboard(buttons);
		return {
			keyboard: keyboard, 
			message: formated_message
		}
	}

	Offer.prototype.convert_callback_to_slot_value = async function(data){
		if (!data){
			return undefined;
		}
		
		var index = data.split('-')[1]

		var variants = await this.get_slots_array()

		return variants[index]
		
	}

	Offer.prototype.published = async function(chat_id, message_id) {
		var current_postings = JSON.parse(this.published_to);
		if (!current_postings){
			current_postings = []
		}

		current_postings.push({chat_id:chat_id, message_id:message_id})

		this.published_to = JSON.stringify(current_postings)
		this.save()
	}




	return Offer;
};
