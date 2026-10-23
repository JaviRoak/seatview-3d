import type {VenueLayout} from '../api/types';
import {BEELE_TARGET} from './beeleLayout';
import {BOCELLI_TARGET} from './bocelliLayout';

export function eventTarget(layout:VenueLayout):[number,number,number]{
  return layout.concert?.kind==='bocelli'?BOCELLI_TARGET:layout.concert?.kind==='beele'?BEELE_TARGET:[0,.2,0];
}
export function eventTargetXZ(layout:VenueLayout):[number,number]{
  const [x,,z]=eventTarget(layout);return [x,z];
}
