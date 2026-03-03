import { TopologyCoordinatorV2 } from '../coordinators/TopologyCoordinatorV2.js';
import { SimulationCoordinatorV2 } from '../coordinators/SimulationCoordinatorV2.js';
import { projectResultV2 } from '../ResultProjector.js';
import { SimulationStateV2 } from '../../simulation/SimulationStateV2.js';

export function runSimulationStepV2({
    circuitModel,
    simulationState = new SimulationStateV2(),
    options = {},
    topologyCoordinator = new TopologyCoordinatorV2(),
    simulationCoordinator = new SimulationCoordinatorV2()
} = {}) {
    const netlist = topologyCoordinator.buildNetlist(circuitModel);
    const solveResult = simulationCoordinator.solveStep({
        netlist,
        simulationState,
        options
    });
    const projection = projectResultV2({
        circuitModel,
        solveResult
    });

    return {
        netlist,
        solveResult,
        projection,
        diagnostics: projection.diagnostics,
        nextState: solveResult.nextState
    };
}
