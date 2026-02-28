import * as ProbeActions from './ProbeActions.js';

export function installInteractionTailProbeDelegates(InteractionManagerClass) {
    Object.assign(InteractionManagerClass.prototype, {
        renameObservationProbe(probeId, nextLabel = null) {
            return ProbeActions.renameObservationProbe.call(this, probeId, nextLabel);
        },

        deleteObservationProbe(probeId) {
            return ProbeActions.deleteObservationProbe.call(this, probeId);
        },

        addProbePlot(probeId) {
            return ProbeActions.addProbePlot.call(this, probeId);
        },

        addObservationProbeForWire(wireId, probeType, options = {}) {
            return ProbeActions.addObservationProbeForWire.call(this, wireId, probeType, options);
        }
    });
}
