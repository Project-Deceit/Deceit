
module deceit::deceit{

    //==============================================================================================
    // Dependencies
    //==============================================================================================
    use std::string::{Self, String};
    use sui::table::{Self, Table};
    use sui::object;

    //==============================================================================================
    // Constants
    //==============================================================================================

    //==============================================================================================
    // Error codes
    //==============================================================================================

    //==============================================================================================
    // Structs 
    //==============================================================================================
    // centralized data
    public struct State has key{
        id: UID,
        score: Table<address, u256>, // <Player_obj_add, score>
        game_records: Table<u64, Game>, // <game_id (in order: 0,1,2...), Game>
    }

    public struct AdminCap has key{
        id: UID,
    }

    // user/agent obj which can will be used in games
    // can be edited by user 
    public struct Player has key{
        id: UID,
        name: String,
        user_add: address,
        prompt: String, //blob_id
    }

    // a new one will be generated for each new game
    // shared object that can be modified by each player involved during their turn
    public struct Game has store{
        responses: String, //blob_id of all responses 
        players: vector<address>, //address of user Player obj_add, NOT user wallet address
        winners: vector<address>, //address of user wallet address 
    }


    //==============================================================================================
    // Event Structs 
    //==============================================================================================

    //==============================================================================================
    // Init
    //==============================================================================================
    fun init(ctx: &mut TxContext){
        let state = State{
            id: object::new(ctx),
            score: table::new(ctx),
            game_records: table::new(ctx)
        };
        transfer::share_object(state);
        let admincap = AdminCap{
            id: object::new(ctx)
        };
        transfer::transfer(admincap, tx_context::sender(ctx));
    }

    //==============================================================================================
    // Entry Functions 
    //==============================================================================================
    entry fun transfer_admin(
        admin_cap: AdminCap,
        new_admin: address,
        _ctx: &mut TxContext
    ){
        transfer::transfer(admin_cap, new_admin);
    }

    public entry fun mint_player(
        username: String,
        prompt: String, //blob_id
        ctx: &mut TxContext
    ){
        let user_add = tx_context::sender(ctx);
        let uid = object::new(ctx);
        let player = Player{
            id: uid,
            name: username,
            user_add,
            prompt
        };
        transfer::transfer(player, user_add);
    }

    public entry fun edit_prompt(
        player: &mut Player,
        new_prompt: String,
        ctx: &mut TxContext
    ){
        player.prompt = new_prompt;
    }

    public entry fun game_concluded(
        responses: String, //blob-id
        winners: vector<address>,
        players: vector<address>,
        _: &AdminCap,
        state: &mut State,
        _ctx: &mut TxContext
    ){
        let game = Game{
            responses,
            players,
            winners
        };
        let count = table::length(&state.game_records);
        table::add(&mut state.game_records, count, game);
    }

    //==============================================================================================
    // Getter Functions 
    //==============================================================================================

    //==============================================================================================
    // Helper Functions 
    //==============================================================================================
}

