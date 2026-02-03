import "./Loader.css";

export const Loader = ({ size = "md", text }) => {
  return (
    <div className="loader-container">
      <div className={`loader loader-${size}`}>
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
      {text && <p className="loader-text">{text}</p>}
    </div>
  );
};
