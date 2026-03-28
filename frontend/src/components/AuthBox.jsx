import { useState } from "react";
import Input from "./Input";

const AuthBox = () => {
  const [type, setType] = useState("login");

  return (
    <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">

      {/* ICON */}
      <div className="flex justify-center mb-3">
        <div className="w-10 h-10 bg-agrice-primary text-white flex items-center justify-center rounded-lg">
          🌾
        </div>
      </div>

      {/* TITLE */}
      <h2 className="text-center font-semibold text-gray-800 mb-4">
        {type === "login" ? "Sign in to AGRICE" : "Create Farmer Account"}
      </h2>

      {/* FORM */}
      <form className="space-y-3">

        {/* REGISTER FIELDS */}
        {type === "register" && (
          <div className="grid grid-cols-2 gap-2">
            <Input label="First Name" />
            <Input label="Last Name" />
          </div>
        )}

        {type === "register" && (
          <Input label="Barangay" />
        )}

        <Input label="Email or Contact Number" />

        {type === "register" && (
          <>
            <Input label="RSBSA Number" />
          </>
        )}

        <Input label="Password" type="password" />

        {type === "register" && (
          <Input label="Confirm Password" type="password" />
        )}

        {/* LOGIN EXTRA */}
        {type === "login" && (
          <div className="flex justify-between text-xs">
            <label className="flex items-center gap-2">
              <input type="checkbox" />
              Remember me
            </label>
            <button className="text-agrice-primary">
              Forgot Password?
            </button>
          </div>
        )}

        {/* BUTTON */}
        <button className="w-full bg-agrice-primary text-white py-2 rounded-md hover:bg-agrice-dark transition">
          {type === "login" ? "Sign In" : "Register"}
        </button>
      </form>

      {/* SWITCH */}
      <p className="text-xs text-center mt-3">
        {type === "login"
          ? "Don't have an account?"
          : "Already have an account?"}

        <button
          onClick={() =>
            setType(type === "login" ? "register" : "login")
          }
          className="ml-1 text-agrice-primary font-medium"
        >
          {type === "login" ? "Register as Farmer" : "Sign In"}
        </button>
      </p>
    </div>
  );
};

export default AuthBox;