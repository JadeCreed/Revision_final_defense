import AuthBox from "./AuthBox";

const Hero = () => {
  return (
    <section
      id="home"
      className="min-h-screen bg-agrice-primary flex items-center "
    >
      <div className="max-w-7xl mx-auto w-full px-6 grid lg:grid-cols-2 gap-10 items-center">

        {/* LEFT TEXT */}
        <div className="text-white">
          <h1 className="text-4xl font-bold leading-tight mb-3">
            The Municipal Agriculture Office (MAO) of Lucban
          </h1>

          <p className="text-green-100 mb-5 max-w-md">
            Supporting sustainable agricultural coordination and rice
            program designed to uplift local farmers.
          </p>

          <button className="bg-white text-agrice-primary px-5 py-2 rounded-md font-semibold hover:bg-gray-100">
            Explore Our Programs
          </button>
        </div>

        {/* RIGHT FORM */}
        <div className="flex justify-center">
          <AuthBox />
        </div>
      </div>
    </section>
  );
};

export default Hero;