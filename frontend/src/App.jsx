import { Route, Routes } from "react-router";
import { Bounce, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import MainLayout from "./layouts/MainLayout";
import Designs from "./features/design/pages/Designs";
import CreateDesign from "./features/design/pages/CreateDesign";
import EditDesign from "./features/design/pages/EditDesign";
import StockIn from "./features/inventory/pages/StockIn";
import StockInDashboard from "./features/inventory/pages/StockInDashboard";
import QrCenter from "./features/inventory/pages/QrCenter";
import QrGrid from "./features/inventory/pages/QrGrid";
import CurrentStock from "./features/inventory/pages/CurrentStock";
import CurrentStockDetail from "./features/inventory/pages/CurrentStockDetail";
import StockHistory from "./features/inventory/pages/StockHistory";
import StockTransformation from "./features/inventory/pages/StockTransformation";
import StockOutLayout from "./features/sales/layouts/StockOutLayout";
import Overview from "./features/sales/pages/Overview";
import Parties from "./features/sales/pages/Parties";
import OrderForms from "./features/sales/pages/OrderForms";
import OrderFormEditor from "./features/sales/pages/OrderFormEditor";
import OrderFormDetail from "./features/sales/pages/OrderFormDetail";
import Invoices from "./features/sales/pages/Invoices";
import InvoiceEditor from "./features/sales/pages/InvoiceEditor";
import InvoiceDetail from "./features/sales/pages/InvoiceDetail";
import Gallery from "./features/sales/pages/Gallery";
import Home from "./pages/Home";

const App = () => {
  return (
    <>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/designs" element={<Designs />} />
          <Route path="/add-designs" element={<CreateDesign />} />
          <Route path="/designs/:id/edit" element={<EditDesign />} />
          <Route path="/stock-in" element={<StockInDashboard />} />
          <Route path="/stock-in/new" element={<StockIn />} />
          <Route path="/stock-in/drafts/:draftId" element={<StockIn />} />
          <Route path="/stock-out" element={<StockOutLayout />}>
            <Route index element={<Overview />} />
            <Route path="orders" element={<OrderForms />} />
            <Route path="orders/new" element={<OrderFormEditor />} />
            <Route path="orders/:id" element={<OrderFormDetail />} />
            <Route path="orders/:id/edit" element={<OrderFormEditor />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="invoices/new" element={<InvoiceEditor />} />
            <Route path="invoices/:id" element={<InvoiceDetail />} />
            <Route path="invoices/:id/edit" element={<InvoiceEditor />} />
            <Route path="parties" element={<Parties />} />
          </Route>
          <Route path="/qr-center" element={<QrCenter />} />
          <Route path="/qr-center/transformation/:transformationId" element={<QrGrid />} />
          <Route path="/qr-center/:stockInTransactionId" element={<QrGrid />} />
          <Route path="/current-stock" element={<CurrentStock />} />
          <Route path="/current-stock/:colorVariantId" element={<CurrentStockDetail />} />
          <Route path="/stock-history" element={<StockHistory />} />
          <Route path="/stock-transformation" element={<StockTransformation />} />
          <Route path="/gallery" element={<Gallery />} />
        </Route>

      </Routes>

      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
        transition={Bounce}
      />
    </>
  );
};

export default App;
