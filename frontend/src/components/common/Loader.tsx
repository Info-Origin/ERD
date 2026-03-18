import './Loader.css';

interface LoaderProps {
  size?: string;
  text?: string;
}

export const Loader = ({ size = 'md', text }: LoaderProps) => (
  <div className="loader-container">
    <div className={`loader loader-${size}`}>
      <div /><div /><div /><div />
    </div>
    {text && <p className="loader-text">{text}</p>}
  </div>
);
