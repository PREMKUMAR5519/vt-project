import './Avatar.scss';
import { getAvatarUrl } from '../../utils/helpers';

export default function Avatar({ src, name, size = 'md', online }) {
  const url = src || getAvatarUrl(name || 'User');

  return (
    <div className={`avatar avatar--${size}`}>
      <img src={url} alt={name || 'User'} />
      {online !== undefined && (
        <span className={`avatar__status ${online ? 'avatar__status--online' : ''}`} />
      )}
    </div>
  );
}
