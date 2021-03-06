'use strict';

const {QueueStatus, QueueType, SETUP_STEPS} = require("../helpers/constants");


const polling_interval = process.env.POLLING_INTERVAL;

const axios = require('axios');

const {setupBalanceManager} = require('./BalanceManager')
const {setupChannelMessageManager} = require('./ChannelMessageManager')

const db = require('../models')

const logger = require('../helpers/logger')

const aff_domain = process.env.AFF_FRONTEND_DOMAIN
const GET_TRANSACTIONS = aff_domain + '/balance/get/transactions'
const UPDATE_TRANSACTIONS_PAID = aff_domain + '/balance/update/transactions/paid'

const GET_MESSAGES = aff_domain + '/messages/get'
const UPDATE_MESSAGES_PUBLISHED = aff_domain + '/messages/update/published'

class RemoteServiceManager {
    constructor(){
        this.db = db;
        logger.info("... RemoteServiceManager created, waiting for init")
    }

    async init(){
        setInterval(async ()=> {
            this.get_transactions();
            this.get_messages();
            this.listen_updates();
        }, polling_interval)

        logger.info("Step %d - SUCCESS: RemoteServiceManager initialized", SETUP_STEPS['RemoteServiceManager']);
        logger.info("... waiting for init_managers");
    }

    async init_managers(){
        try {
            this.balance_manager = await setupBalanceManager()
            this.message_manager = await setupChannelMessageManager()

            await this.balance_manager.init()
            await this.message_manager.init()
        }catch(error){
            logger.error("STEP %d - FAILED: RemoteServiceManager.init_managers error %s", SETUP_STEPS['RemoteServiceManager'], error)
            return;
        }
        
        logger.info("STEP %d - SUCCESS: RemoteServiceManager.init_managers", SETUP_STEPS['RemoteServiceManager'])
    }

    async _handle_transactions(transactions){
        await this.db.RemoteServiceManagerQueue.create(
            {
                status : QueueStatus.new,
                type : QueueType.transactions,
                message : JSON.stringify(transactions)
            }
        )
    }

    async _handle_messages(messages){
        await this.db.RemoteServiceManagerQueue.create(
            {
                status : QueueStatus.new,
                type : QueueType.messages,
                message : JSON.stringify(messages)
            }
        )
    }

    async listen_updates(){
        var tx_updates = await this.balance_manager.ready_to_sync_array()
        if (tx_updates){
            var data = {
                'aggregated_transaction_ids' : tx_updates
            }
            this.update_transacitons(data)
        }

        var msg_updates = await this.message_manager.ready_to_sync_array()
        if (msg_updates){
            var data = {
                'aggregated_messages_ids' : msg_updates
            }
            this.update_messages(data)
        }

    }


    async update_transacitons(data){
        var aggregated_transaction_ids = data['aggregated_transaction_ids']
        if (aggregated_transaction_ids.length <= 0){
            return;
        }
        axios.post(UPDATE_TRANSACTIONS_PAID, 
            { data : aggregated_transaction_ids})
        .then(response => {
            this.db.BalanceManagerQueue.sync_list(aggregated_transaction_ids)
        })
        .catch(error => {
            logger.error(error);
        });
    }

    async update_messages(data){
        var aggregated_messages_ids = data['aggregated_messages_ids']
        if (aggregated_messages_ids.length <= 0){
            return;
        }
          
        axios.post(UPDATE_MESSAGES_PUBLISHED, 
            { data : aggregated_messages_ids})
        .then(response => {
            this.db.ChannelMessageManagerQueue.sync_list(aggregated_messages_ids)
        })
        .catch(error => {
            logger.error(error);
        });

    }

    async get_transactions(){
        axios.get(GET_TRANSACTIONS)
        .then(response => {
            this._handle_transactions(response.data)
        })
        .catch(error => {
            logger.error(error);
        });
    }

    async get_messages(){
        axios.get(GET_MESSAGES)
        .then(response => {
            this._handle_messages(response.data)
        })
        .catch(error => {
            logger.error(error);
        });

    }
}

let aff_sync_manager = undefined;

async function init(){
    if (!aff_sync_manager){
        aff_sync_manager = new RemoteServiceManager();
    }

    await aff_sync_manager.init()
    await aff_sync_manager.init_managers()

}

module.exports = {
    init
}
