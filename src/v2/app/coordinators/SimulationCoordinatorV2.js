import { solveCircuitV2 } from '../../simulation/SolveCircuitV2.js';
import { SimulationStateV2 } from '../../simulation/SimulationStateV2.js';

export class SimulationCoordinatorV2 {
    constructor({ solve = solveCircuitV2 } = {}) {
        this.solve = solve;
    }

    solveStep({ netlist, simulationState = new SimulationStateV2(), options = {} } = {}) {
        return this.solve(netlist, simulationState, options);
    }
}
