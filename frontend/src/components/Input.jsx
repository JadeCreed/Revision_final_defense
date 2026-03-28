const Input = ({ label, type = "text", ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      
      {/* LABEL */}
      <label className="text-sm text-gray-600">{label}</label>

      {/* INPUT FIELD */}
      <input
        type={type}
        {...props}
        className="
          bg-gray-100 
          border border-gray-200 
          rounded-md 
          px-3 py-2 
          text-sm
          focus:outline-none 
          focus:ring-2 
          focus:ring-agrice-primary
        "
      />
    </div>
  );
};

export default Input;