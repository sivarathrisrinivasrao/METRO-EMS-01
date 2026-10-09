import { useLocation, useParams } from 'react-router-dom';
import TranscoderSummary from './Transcoder';
import ObcSummary from './Obc';
import StationRadiosSummary from './StationRadios';
import TrainRadiosSummary from './TrainRadios';
import EncoderSummary from './Encoder';
import IoBoxControllerSummary from './IOBoxController';

const DeviceManagement = () => {
  const location = useLocation();
  const { type,id,trainId } = useParams();

  switch (type) {
    case 'transcoder':
      return <TranscoderSummary ip={id} navState={location.state} />;
    case 'obc':
      return <ObcSummary ip={id} navState={location.state} />;
    case 'station-radios':
      return <StationRadiosSummary ip={id} navState={location.state} />;
    case 'train-radios':
      return <TrainRadiosSummary ip={id} navState={location.state} />;
    case 'encoder':
      return <EncoderSummary ip={id} navState={location.state} />;
    case 'io-box':
      return <IoBoxControllerSummary ip={id} trainId={trainId} navState={location.state} />;
    default:
      return <p className="text-black">Device type not supported.</p>;
  }
};

export default DeviceManagement;