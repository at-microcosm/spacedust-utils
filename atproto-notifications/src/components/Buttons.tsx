import './Buttons.css';

export function ButtonGroup({ options, current, onChange }) {
  return (
    <div className='button-group'>
      {options.map(({val, label}) => (
        <button
          key={val}
          className={val === current ? 'current' : ''}
          onClick={() => onChange(val)}
        >
          {label ?? val}
        </button>
      ))}
    </div>
  );
}
