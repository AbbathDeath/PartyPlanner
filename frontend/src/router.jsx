import {createBrowserRouter } from 'react-router';
import App from "./App";
import SignUpPage from './сomponents/SignupPage';
import LoginPage from './сomponents/LoginPage';
import Dashboard from './сomponents/Dashboard';

export const router = createBrowserRouter([
    {path: "/", element: <App />},
    {path: "/signup", element: <SignUpPage />},
    {path: "/login", element: <LoginPage />},
    {path: "/dashboard", element: <Dashboard />},
]);