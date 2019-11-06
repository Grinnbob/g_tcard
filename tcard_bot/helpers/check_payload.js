'use strict';

const logger = require('../helpers/logger')
const {APPLY_BUTTON_PREFIX} = require("../helpers/constants");


async function offer_apply(ctx){
    return ctx.scene.enter('apply-offer-wizard')
}

module.exports = async function check_payload(ctx, data){
        if (!data){
            return null;
        }

try{
        if(data.startsWith(APPLY_BUTTON_PREFIX)){
            var match = data.split('-')
            try{
                if (match[1]){
                    ctx.state.apply_offer_id = match[1]
                    return offer_apply;
                }
            }catch(error){
                return null;
            }
        }
}catch(error){
    logger.error("FAILED check_payload: This should never happened %s", error)
}    
    
    return null;
}