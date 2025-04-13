import { Address, beginCell, Cell, Contract, contractAddress, ContractProvider, Sender, SendMode, toNano } from '@ton/core';
import { Op } from "./Ops";


export type VotingConfig = {
    master: Address,
    voting_id: bigint
};

export class Voting implements Contract {
    constructor(readonly address: Address, readonly init?: { code: Cell; data: Cell }) {}

    static votingConfigToCell(conf: VotingConfig) {
        return beginCell().storeBit(false).storeAddress(conf.master).storeUint(conf.voting_id, 64).endCell();
    }
    static createFromAddress(address: Address) {
        return new Voting(address);
    }

    static createFromConfig(conf:VotingConfig, code:Cell, workchain = 0) {
        const data = Voting.votingConfigToCell(conf);
        const init = {code, data};
        return new Voting(contractAddress(workchain, init), init);
    }

    static endVotingMessage(query_id:bigint = 0n) {
        return beginCell().storeUint(Op.voting.end_voting, 32).storeUint(query_id, 64).endCell();
    }

    async sendEndVoting(provider: ContractProvider, via: Sender, value:bigint=toNano('0.5')) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: Voting.endVotingMessage(),
            value
        });
    }

/*
    return (init, executed,
            dao_address, initiator,
            voting_id, expiration_date, voting_type,
            ;; proposal
            minimal_execution_amount, message, description,
            voted_for, voted_against);
*/
    async getData(provider: ContractProvider) {
        const res = await provider.get('get_voting_data', []);
        const init = res.stack.readBoolean();
        const executed = res.stack.readBoolean();
        const daoAddress = res.stack.readAddress();
        const initiator = res.stack.readAddress();
        const votingId = res.stack.readBigNumber();
        const expirationDate = res.stack.readBigNumber();
        const votingType = res.stack.readBigNumber();
        const minAmount = res.stack.readBigNumber();
        const message = res.stack.readCellOpt();
        const description = res.stack.readString();
        const votedFor = res.stack.readBigNumber();
        const votedAgainst = res.stack.readBigNumber();
        return {
            init, executed,
            daoAddress, initiator,
            votingId, expirationDate, votingType,
            minAmount, message, description,
            votedFor, votedAgainst,
        };
    }
/*
(init, dao_address, voting_id, expiration_date, voting_type,
            proposal, wallet_code,
            voted_for, voted_against,
            executed, initiator);
*/
    async getFullData(provider: ContractProvider) {
        const res = await provider.get('get_full_voting_data', []);
        const init = res.stack.readBoolean();
        const daoAddress = res.stack.readAddress();
        const votingId = res.stack.readBigNumber();
        const expirationDate = res.stack.readBigNumber();
        const votingType = res.stack.readBigNumber();
        const proposal = res.stack.readCell();
        const walletCode = res.stack.readCell();
        const votedFor = res.stack.readBigNumber();
        const votedAgainst = res.stack.readBigNumber();
        const executed = res.stack.readBoolean();
        const initiator = res.stack.readAddress();
        return {
            init,
            daoAddress,
            votingId,
            expirationDate,
            votingType,
            proposal,
            walletCode,
            votedFor,
            votedAgainst,
            executed,
            initiator,
        };
    }
    static createSendMsgProposalBody(minimal_execution_amount:bigint, forwardMsg:Cell, description: string = "Sample description") {
        return beginCell()
                .storeCoins(minimal_execution_amount)
                .storeMaybeRef(forwardMsg)
                .storeStringTail(description)
               .endCell();
    }

    static createPollProposal(voting_duration: bigint | number, body: Cell | string = "Sample description") {
        if (typeof body === "string")
          body = beginCell().storeStringTail(body).endCell();
        return beginCell()
                .storeUint(voting_duration, 48)
                .storeRef(body)
               .endCell();
    }
}
