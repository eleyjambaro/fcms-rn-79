import React from 'react';

import AuthContextProvider from '../context/providers/AuthContextProvider';

const withAuthContextProvider = WrappedComponent => {
    return function (props) {
        return (
            <AuthContextProvider>
                <WrappedComponent {...props} />
            </AuthContextProvider>
        );
    };
};

export default withAuthContextProvider;
