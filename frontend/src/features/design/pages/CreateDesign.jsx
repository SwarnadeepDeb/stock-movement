import DesignWizard from "../components/DesignWizard";

const CreateDesign = () => {
  return (
    <section>
      {/* header section */}
      <div className="mb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1E1B4B] tracking-tight">
            Register Design
          </h1>
        </div>
      </div>

      <div className="rounded-[24px] px-3">
        <DesignWizard />
      </div>
    </section>
  );
};

export default CreateDesign;
