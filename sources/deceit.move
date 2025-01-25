
module deceit::deceit{

    //==============================================================================================
    // Dependencies
    //==============================================================================================
    use std::string::{String};
    use sui::table::{Self, Table};
    use deceit::gold::{Self, GOLD};
    use sui::coin::{TreasuryCap};

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
        name: String,
        responses: Option<String>, //blob_id of all responses 
        players: vector<address>, //address of user Player obj_add, NOT user wallet address
        winners: vector<address>, //address of user Player obj_add
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

    entry fun start_game(
        name: String,
        players: vector<address>,
        _: &AdminCap,
        state: &mut State,
        _ctx: &mut TxContext
    ){
        let game = Game{
            name,
            responses: option::none(),
            players,
            winners: vector::empty(),
        };
        let count = table::length(&state.game_records);
        table::add(&mut state.game_records, count, game);
    }

    entry fun game_concluded(
        game_id: u64,
        responses: String, //blob-id
        reward: u64, //GOLD to reward per winner
        winners: vector<address>,
        _: &AdminCap,
        treasury_cap: &mut TreasuryCap<GOLD>,
        state: &mut State,
        ctx: &mut TxContext
    ){
        let game = table::borrow_mut(&mut state.game_records, game_id);
        game.responses = option::some(responses);
        game.winners = winners;
        let mut i = 0;
        while(i <  vector::length(&winners)){
            let winner = *vector::borrow(&winners, i);
            let score = table::borrow_mut(&mut state.score, winner);
            *score = *score + 1;
            gold::mint(treasury_cap, reward, winner, ctx);
            i = i + 1;
        };  
    }

    //==============================================================================================
    // Getter Functions 
    //==============================================================================================

    //==============================================================================================
    // Helper Functions 
    //==============================================================================================
}

